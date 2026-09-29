# 현황

기준일 2026-09-30. `main` 커밋 `53cb68d`(PR #5 병합).

## 자동 테스트 현황

저장소에는 테스트 파일이나 테스트 러너가 없다. GitHub Actions에는 배포 잡만 있고, PR 검사는 없다. 아래 "검증"은 2026-09-30에 로컬에서 직접 실행한 명령과 운영 사이트 응답을 뜻한다.

## 사이트 배포 체계

| 항목 | 상태 | 근거 |
|---|---|---|
| 폴더 이름 → `<이름>.external.kr` 라우팅 (`router/worker.js`) | 만들고 검증함 | 운영 `https://cualign.external.kr/` 200. 가짜 바인딩 스모크 테스트에서 다른 호스트 404 확인 |
| `.html` 리다이렉트의 내부 접두어 제거 | 만들고 검증함 | 운영 `/eula.html` → 307 `Location: /eula`, `/docs` → 307 `Location: /docs/` |
| 사이트 `404.html`로 404 응답 | 만들고 검증함 | 운영 `/nope` 404, 스모크 테스트 통과 |
| 배포 워크플로(검사, `dist/` 조립, 라우트, `wrangler deploy`) | 만들고 검증함 | 배포 실행 12회 중 Cloudflare Pages를 쓰던 처음 2회만 저장소 시크릿이 없어 실패했고, Worker 정적 자산으로 바꾼 커밋 `e8aad82` 이후 10회는 모두 성공(최근 8회 19~31초, `gh run list`로 2026-09-30 확인). 같은 build 단계를 로컬에서 재현해 `dist/cualign/`, `dist/_forms/cualign.json`, 라우트 1개 생성 확인 |
| 사이트 삭제 시 라우트 제거 | 검증함 | 2026-09-28에 지운 `hello`의 `hello.external.kr`이 2026-09-30에 523 |

## 양식 엔드포인트

| 항목 | 상태 | 근거 |
|---|---|---|
| `POST /_forms/<폼>` 검증과 R2 저장 (`router/forms.js`) | 만들고 로컬 스모크 테스트로 검증함 | 가짜 `ASSETS`·`FORMS`로 200·303·400·403·404·405·413·415 응답과 저장 레코드(IP 없음)를 확인. 운영에서 실제 제출은 하지 않았다(운영 R2에 시험 기록을 남기지 않기 위해) |
| `forms.json` 비공개 | 검증함 | 운영 `/_forms/cualign.json` 404 |
| 받은 요청 조회·삭제 절차(README의 curl·wrangler 명령) | 문서만 있음, 검증 안 함 | 이번 확인에서 R2 토큰을 쓰지 않았다 |

## cualign 사이트

| 항목 | 상태 | 근거 |
|---|---|---|
| 영어 랜딩(`index.html`, `styles.css`, `app.js`) | 만들고 운영 중, 브라우저 동작 자동 검증 없음 | 운영 200. `node --check app.js` 통과 |
| 히어로 3D(`hero3d.js`, `hero-fx.js`, `assets/hero-case.json`) | 만들고 운영 중, 렌더링 자동 검증 없음 | 두 파일 `node --check` 통과, `hero-case.json` 파싱 확인(케이스 `poseidon-000097`, 27단계, `removed` 5·12, `passed: true`) |
| EULA 동의 창과 프로토타입 이동 | 만들고 운영 중, 자동 검증 없음 | `/eula` 200, `https://cualign-proto.external.kr/` 401(Basic 인증) |
| 데모 요청 페이지 `/request/`와 `/request/thanks` | 만들고 운영 중, 실제 제출은 검증 안 함 | `/request/` 200. 입력 제한이 `forms.json`과 같은지 코드로 대조함 |
| 에이전트 문서(`docs/*.md` 11개, 뷰어, `llms.txt`, `llms-full.txt`) | 만들고 검증함 | 상대 링크 확인 통과. 생성 명령으로 다시 만든 두 파일이 커밋된 파일과 바이트 단위로 같음. 운영 `/docs/`, `/llms.txt` 200 |
| 문서 예시가 cuAlign 현재 코드와 맞는지 | 검증 안 함 | cuAlign 저장소는 이 저장소 밖에 있다 |

## 남은 일

1. 양식 스팸 대응 강화(속도 제한 등). 지금은 허니팟 하나뿐이다.
2. 양식 기록 보존 기간과 삭제 절차를 정해 요청 페이지 안내에 적는 일.
3. 사이트 폴더에 들어 있는 작업용 README가 공개되는 문제의 정리.
4. 외부 CDN 스크립트의 무결성(SRI) 적용.
5. PR 단계에서 도는 자동 검사. 지금은 로컬 검사에만 기대고 있다.
