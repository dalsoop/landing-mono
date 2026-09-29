# landing-mono

빌드 단계 없는 정적 랜딩 페이지를 모아 두는 작은 모노레포다. `apps/<사이트>/` 폴더 하나가 `https://<사이트>.external.kr` 하나가 되고, `main`에 푸시하면 GitHub Actions가 모든 사이트를 Cloudflare Worker `landing-mono` 하나의 정적 자산으로 곧바로 운영에 배포한다.
현재 사이트는 cuAlign(치과 투명 교정 계획 연구용 프로토타입)의 영어 소개 페이지 `cualign` 하나뿐이다. 프레임워크, 패키지 매니저, 테스트 러너는 없고 HTML·CSS·브라우저 JavaScript와 Worker 스크립트 두 개가 전부다.

## 프로젝트 구조

```
landing-mono/
├── CLAUDE.md                          ← 진입점 (AGENTS.md와 같은 내용)
├── AGENTS.md                          ← 진입점 (CLAUDE.md와 같은 내용)
├── README.md                          ← 사람용 소개: 배포, 새 사이트 추가, 양식, 저장소 시크릿
├── .github/workflows/deploy.yml       ← main 푸시 때 사이트를 모아 Worker로 배포하는 유일한 경로
├── router/
│   └── AGENTS.md                      ← Worker 코드: 호스트→사이트 폴더 라우팅, /_forms 양식 엔드포인트
├── apps/
│   └── AGENTS.md                      ← 사이트 폴더 규칙과 cualign 사이트의 구현 패턴
└── docs/
    ├── architecture.md                ← 배포 파이프라인, Worker, 정적 자산, R2의 연결과 요청 흐름
    ├── business-rules.md              ← 사이트·도메인 규칙, 양식 검증 규칙, cualign 동의·문구 규칙
    ├── security.md                    ← 양식 개인정보, Origin 검사, 시크릿, 공개되는 파일
    ├── standards.md                   ← 배포 전 반드시 통과할 검사와 폴더·이름·커밋 규칙
    ├── engineering-notes.md           ← 리다이렉트 접두어, 404 처리, llms 생성 같은 함정
    ├── operations.md                  ← 로컬 확인, 배포, 받은 양식 조회·삭제 절차
    ├── contracts.md                   ← POST /_forms/<폼> 응답 계약과 사이트 URL 규칙
    └── tracking/
        ├── status.md                  ← 만든 것과 검증한 것, 남은 일
        ├── findings.md                ← 지금 풀 수 없는 문제
        └── decisions/
            ├── index.md               ← 결정 목록
            ├── 0001-worker-static-assets.md
            ├── 0002-folder-name-is-subdomain.md
            └── 0003-english-landing-korean-ui-note.md
```

## 반드시 지킬 것

1. `main`에 들어간 커밋은 몇십 초 안에 운영 사이트가 된다. `main`에 직접 푸시하지 않고 브랜치와 PR로 합치며, 합치기 전에 `docs/standards.md`의 로컬 검사를 모두 통과시킨다.
2. `apps/<사이트>/` 안의 파일은 `forms.json`을 빼고 전부 그대로 공개된다. 비밀 값, 내부 메모, 개인정보를 사이트 폴더에 두지 않는다.
3. 양식 기록에는 IP 주소를 저장하지 않는다. `router/forms.js`의 저장 레코드에 필드를 더할 때는 사이트의 개인정보 안내 문구(cualign은 `request/index.html`의 "How we handle your request")를 같은 변경에서 고친다.
4. 이미 다른 서비스가 쓰는 `external.kr` 서브도메인(`cualign-proto`, `immich`, `cdn`, `postiz` 등)과 같은 이름으로 사이트 폴더를 만들지 않는다.
5. cualign 페이지의 제품 설명은 cuAlign 저장소(`dalsoop/nvidia-hackaton-2026-one`)의 문서와 코드에 적힌 사실만 옮긴다. 임상 효능, 인증, 가격처럼 그 저장소에 없는 주장을 만들지 않는다.

## 작업 전에 읽을 것

- 항상: `docs/standards.md`, `docs/engineering-notes.md`, 고칠 폴더의 `AGENTS.md`(`router/` 또는 `apps/`).
- `router/worker.js`나 `router/forms.js`를 고치기 전: `docs/contracts.md`의 상태 코드 표와 `docs/security.md`의 양식 보호 규칙. 사이트의 요청 페이지 스크립트가 `error`, `fields` 값을 그대로 해석한다.
- `.github/workflows/deploy.yml`을 고치기 전: `docs/architecture.md`의 배포 흐름. 사이트 하나라도 규칙을 어기면 모든 사이트의 배포가 멈춘다.
- 사이트를 새로 만들거나 이름을 바꾸기 전: `docs/business-rules.md`의 사이트·도메인 규칙과 404·리다이렉트 함정.
- `apps/cualign/eula.html`, `apps/cualign/docs/*.md`, `forms.json`을 고치기 전: `apps/AGENTS.md`의 짝 수정 목록(EULA 버전, llms 재생성, 요청 페이지 입력 제한).

## 문제를 발견하면

즉시 사용자에게 알릴 것:
- 운영 사이트(`*.external.kr`)가 열리지 않거나 배포 워크플로가 실패한 상태로 `main`이 앞서 나간 경우
- 양식 제출이 저장되지 않거나(`storage_unavailable`, R2 오류), 다른 사이트의 Origin에서 온 제출이 저장되는 경우
- 받은 양식 기록이나 `CLOUDFLARE_API_TOKEN` 같은 비밀 값이 공개 경로(사이트 폴더, 커밋, 로그)에 노출된 경우
- 사이트 폴더 이름이 기존 서비스 서브도메인을 가로채거나 그 서비스를 막은 경우

그 밖의 문제는 `docs/tracking/findings.md`에 조건, 증상, 영향, 지금 풀 수 없는 이유를 적는다.
