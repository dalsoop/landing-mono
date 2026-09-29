# 아키텍처

## 구성 요소와 연결

```
GitHub (dalsoop/landing-mono, main)
   │ push (apps/**, router/**, deploy.yml 경로만)
   ▼
GitHub Actions "deploy" ── build: apps/* → dist/, forms.json → dist/_forms/, wrangler.json 생성
   │ npx wrangler@4 deploy
   ▼
Cloudflare Worker "landing-mono"
   ├── main: router/worker.js (+ router/forms.js)
   ├── 바인딩 ASSETS: dist/ 정적 자산 (run_worker_first: true)
   ├── 바인딩 FORMS: R2 버킷 landing-forms
   └── 라우트: 사이트마다 <사이트>.external.kr/* (zone external.kr)
          ▲
브라우저 ── *.external.kr 와일드카드 DNS(Cloudflare 프록시) ──┘
```

| 구성 요소 | 역할 | 의존 방향 |
|---|---|---|
| `apps/<사이트>/` | 사이트 하나의 정적 파일. 빌드 없이 그대로 자산이 된다 | 아무것도 참조하지 않는다. `forms.json`으로 Worker 양식 엔드포인트에 설정을 준다 |
| `.github/workflows/deploy.yml` | 사이트 폴더를 검사해 `dist/`로 모으고, 라우트 목록과 `wrangler.json`을 만들어 배포한다 | `apps/*`, `router/*`, 저장소 시크릿 두 개에 의존한다 |
| `router/worker.js` | 요청 호스트에서 사이트 이름을 뽑아 `/<사이트>/…` 자산을 돌려주거나 `/_forms/`를 `forms.js`로 넘긴다 | `ASSETS` 바인딩, `forms.js` |
| `router/forms.js` | 사이트별 폼 설정을 자산에서 읽고 제출을 검증해 R2에 저장한다 | `ASSETS`(설정), `FORMS`(R2) |
| R2 `landing-forms` | 양식 제출 기록 저장소. 운영자가 API나 wrangler로 읽고 지운다 | 없음 |
| `cualign-proto.external.kr` | cuAlign 호스팅 프로토타입. 이 저장소 밖에서 운영되고 Basic 인증으로 막혀 있다 | cualign 페이지가 링크만 건다 |

`wrangler.json`은 저장소에 없다. 배포할 때마다 워크플로가 `apps/*` 폴더 목록으로 새로 만들며, `compatibility_date`는 `2025-09-01`, Worker 이름은 `landing-mono`, 루트 도메인은 `external.kr`로 워크플로의 `env`에 고정되어 있다.

## 배포 흐름

1. `main`에 `apps/**`, `router/**`, `.github/workflows/deploy.yml` 중 하나라도 바뀐 커밋이 들어오면 `deploy` 잡이 돈다. 수동 실행(`workflow_dispatch`)도 된다. 동시 실행 그룹 `deploy` 때문에 배포는 한 번에 하나만 돌고, 진행 중인 배포는 취소되지 않는다. 대기 중인 실행은 GitHub 규칙에 따라 가장 최근 것 하나만 남는다.
2. 시크릿 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`가 비어 있으면 실패한다.
3. `apps/*/` 폴더를 하나씩 돌며 이름 규칙과 `index.html` 존재를 검사하고 `dist/<사이트>/`로 복사한다. `forms.json`이 있으면 형식을 검사한 뒤 `dist/_forms/<사이트>.json`으로 옮긴다. 폴더 하나라도 검사에 걸리면 잡 전체가 실패하고 어떤 사이트도 배포되지 않는다.
4. 폴더마다 라우트 `<사이트>.external.kr/*`를 만들고 `wrangler deploy`로 Worker, 자산, 라우트를 한 번에 올린다. 바뀐 사이트만 골라 올리지 않고 매번 모든 사이트를 다시 올린다.
5. 폴더를 지우면 다음 배포의 라우트 목록에서 빠져 그 서브도메인은 Worker를 거치지 않는다. 2026-09-28에 지운 `hello` 사이트의 `hello.external.kr`은 2026-09-30에 Cloudflare 523을 돌려주었다.

## 요청 흐름

페이지 요청 `GET https://cualign.external.kr/eula.html`:
1. 라우트 `cualign.external.kr/*`가 Worker를 부른다. `run_worker_first: true`이므로 자산보다 Worker가 먼저 받는다.
2. `worker.js`가 호스트에서 `.external.kr`을 떼어 `cualign`을 얻고 이름 규칙으로 확인한다. 규칙에 맞지 않거나 다른 도메인이면 평문 404다.
3. 경로 앞에 `/cualign`을 붙여 `ASSETS`에 묻는다. 정적 자산은 `.html` 경로를 확장자 없는 경로로 307 리다이렉트하므로 `Location: /cualign/eula`가 오고, Worker가 `/cualign` 접두어를 떼어 `Location: /eula`로 돌려준다.
4. 자산이 404면 `/cualign/404`(사이트의 `404.html`)를 다시 받아 상태 404로 돌려준다. 사이트에 `404.html`이 없으면 평문 `Not Found`다.

양식 요청 `POST https://cualign.external.kr/_forms/demo-request`:
1. `worker.js`가 경로 접두어 `/_forms/`를 보고 `handleForm(request, env, "cualign", "demo-request")`를 부른다. 이 경로는 자산으로 가지 않는다.
2. `forms.js`가 `ASSETS`에서 `/_forms/cualign.json`을 읽어 폼 설정을 찾고, 메서드, Origin, 크기, 인코딩, 허니팟, 필드 규칙을 차례로 검사한다.
3. 통과하면 `FORMS.put("cualign/demo-request/<ISO시각>-<uuid>.json", …)`으로 R2에 쓰고, JSON 요청에는 `{"ok":true}`, JavaScript 없는 폼 제출에는 303 리다이렉트를 돌려준다.

## 경계

- 브라우저가 닿는 것은 라우트가 붙은 서브도메인의 `/<사이트>/` 아래 자산과 `/_forms/<폼>` 엔드포인트뿐이다. `dist/_forms/*.json`은 자산 안에 있지만 브라우저의 `/_forms/…` 요청은 모두 양식 처리기로 가므로 읽히지 않는다.
- 한 사이트의 호스트로는 다른 사이트의 폴더를 읽을 수 없다. Worker가 경로 앞에 항상 자기 사이트 이름을 붙이기 때문이다.
- cuAlign 제품 자체(서버, 계획 엔진, 호스팅 프로토타입)는 이 저장소에 없다. cualign 페이지는 그 저장소의 문서와 결과물을 옮겨 온 정적 사본이다.
- 페이지는 외부 CDN에서 스크립트와 글꼴을 받는다. three.js 0.160.0, marked 12.0.2, DOMPurify 3.1.6은 cdnjs에서, 글꼴은 Google Fonts에서 받는다.
