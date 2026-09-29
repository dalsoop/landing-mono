# apps

사이트 폴더를 모아 두는 곳이다. `apps/<사이트>/` 폴더 하나가 `https://<사이트>.external.kr` 하나이며, 빌드 없이 폴더의 파일이 그대로 공개 자산이 된다. 현재 사이트는 `cualign` 하나다.

## 맡는 일

- 각 사이트의 HTML, CSS, 브라우저 JavaScript, 이미지, 공개 문서, `robots.txt`, `sitemap.xml`, `404.html`.
- 사이트가 받는 양식의 설정 `forms.json`.

## 맡지 않는 일

- 호스트 라우팅, 리다이렉트, 404 처리, 양식 검증과 저장은 `router/`의 일이다. 사이트 폴더에 서버 코드(`_worker.js`, 함수 폴더)를 두어도 실행되지 않는다.
- 배포, 라우트, DNS는 워크플로와 Cloudflare 설정의 일이다. 사이트별 설정 파일(`site.json` 등)을 만들지 않는다.
- cuAlign 제품 코드(서버, 계획 엔진, 호스팅 프로토타입 `cualign-proto.external.kr`)는 다른 저장소(`dalsoop/nvidia-hackaton-2026-one`)에 있다. 이 폴더에서 제품 동작을 고치지 않는다.

## 사이트 폴더 공통 불변 조건

- 폴더 이름은 `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`이고, 이미 다른 서비스가 쓰는 `external.kr` 서브도메인과 겹치지 않는다.
- `index.html`이 있다.
- `forms.json`을 뺀 모든 파일이 공개된다. 비밀 값, 개인정보, 내부 전용 메모를 두지 않는다. 지금 있는 `README.md`도 공개되고 있다.
- 페이지 안의 경로는 사이트 루트 기준(`/styles.css`) 또는 상대 경로다. `/<사이트>/…` 경로를 쓰지 않는다.
- `404.html`의 자산 경로는 루트 기준 절대 경로다. 404 페이지는 어느 깊이의 경로에서도 보이기 때문이다.
- 폼의 `action`은 `/_forms/<폼>`이고, `<폼>`은 그 사이트 `forms.json`의 키다.
- 폼 입력의 `name`, `required`, `maxlength`, 선택지는 `forms.json`의 `fields`, `required`, `max_length`, `options`와 같다. 허니팟 입력 `name="website"`은 화면 밖에 두고 `tabindex="-1"`, `autocomplete="off"`로 둔다.

## cualign

### 파일 역할

- `index.html`, `styles.css`, `app.js`: 영어 랜딩. `app.js`는 IIFE 하나로 내비게이션, 스크롤 등장, 히어로 3D 부팅, 에이전트 대화 데모, 단계 슬라이더, EULA 동의 창을 맡는다. DOM은 `data-*` 속성으로 찾는다.
- `hero3d.js`, `hero-fx.js`: 히어로 3D ES 모듈. `app.js`가 WebGL이 있고 동작 줄이기 설정이 꺼져 있을 때만 `import('./hero3d.js')`로 불러온다. three.js 0.160.0을 cdnjs URL에서 직접 import한다.
- `assets/hero-case.json`: 히어로가 재생하는 계획 데이터(`case`, `n_stages`, `removed`, `teeth`, `gum`, `stages`, `rotations`, `pivots`, `violations`, `passed`). 치아 키와 `removed`는 Universal 번호 문자열이다.
- `assets/stages/000001-00.webp`~`000001-18.webp`, `assets/arch-000131-pass.webp`: 단계 슬라이더와 대화 데모 캡처.
- `eula.html`: 약관. `request/index.html`, `request/thanks.html`, `forms.json`: 데모 요청 양식.
- `apps/cualign/docs/*.md`, `apps/cualign/docs/index.html`, `llms.txt`, `llms-full.txt`: 에이전트용 cuAlign 문서와 뷰어. `apps/cualign/docs/README.md`에 생성 명령이 있다.

### 불변 조건

- `app.js`의 `EULA_VERSION`, `eula.html`의 "Version" 표기는 같은 날짜다. 약관 문구를 바꾸면 둘을 새 날짜로 함께 올린다. 동의 저장 키 `cualign.eula`는 바꾸지 않는다(바꾸면 기존 동의가 모두 사라진 것처럼 보인다).
- "Launch prototype"은 동의 없이 `LAUNCH_URL`로 이동하지 않는다. 두 확인란이 모두 체크되어야 동의가 저장된다.
- `DEMO_FORM_URL`이 비어 있으면 `data-demo-request` 버튼을 숨긴다. 이 동작을 지우지 않는다.
- 슬라이더 `max`(18)와 이미지 수(19장), `app.js`의 충돌 표시 범위(6~12단계)는 캡처 세트와 맞아야 한다.
- 대화 데모의 `STEP_OF_MSG`, `MEDIA_OF_MSG` 배열 길이는 `.msg` 개수(5)와 같아야 한다.
- `llms.txt`, `llms-full.txt`는 생성물이다. `apps/cualign/docs/*.md`를 고치면 다시 만들어 같은 커밋에 넣는다.
- `apps/cualign/docs/*.md`의 front matter는 `title`, `description`, `order`, `updated`를 가지고 LF 줄바꿈이다. 상대 링크는 `.md` 파일로 건다.
- 제품 설명은 cuAlign 저장소의 README, `docs/OVERVIEW.md`, `docs/NVIDIA_STACK.md`, `docs/VERIFICATION.md`, `evals/`에 적힌 사실만 옮긴다. "Research prototype. Not for clinical use." 고지와 의료기기가 아니라는 FAQ 답을 빼지 않는다.
- 랜딩 문구는 영어다. 한국어 전용 인터페이스라는 사실은 FAQ 한 줄과 `apps/cualign/docs/`에만 둔다.
- 요청 페이지의 개인정보 안내("How we handle your request")는 `router/forms.js`가 실제로 저장하는 항목과 같아야 한다.

### 구현 방식

- 브라우저 저장소 접근은 모두 `try/catch`로 감싸고, 실패하면 저장 없이 동작한다.
- 애니메이션은 `prefers-reduced-motion`이면 끄고 결과 상태를 바로 보여 준다. 새 애니메이션도 이 규칙을 따른다.
- 히어로 3D는 실패해도 오류를 표시하지 않고 자리를 비워 둔다. 로딩 포스터 이미지는 두지 않는다.
- 문서 뷰어는 `marked`로 그린 HTML을 `DOMPurify.sanitize`로 정리한 뒤에만 `innerHTML`에 넣는다.

### 테스트

자동 테스트는 없다. 고친 뒤 다음을 확인한다.

1. `node --check apps/cualign/app.js apps/cualign/hero3d.js apps/cualign/hero-fx.js`(파일마다 따로), `jq -e . apps/cualign/forms.json apps/cualign/assets/hero-case.json`.
2. `apps/cualign/docs/*.md`를 고쳤다면 `apps/cualign/`에서 `apps/cualign/docs/README.md`의 생성 명령과 링크 확인 명령을 실행하고 `git diff`로 llms 파일 변화를 확인한다.
3. 브라우저에서 사이트 폴더를 정적 서버 루트로 열어 확인한다: 히어로 3D가 뜨는지(동작 줄이기 설정을 켜면 비어야 한다), 슬라이더 자동 재생과 멈춤, 대화 데모 재생과 Replay, 동의 창의 두 확인란 규칙, 요청 페이지의 필수 항목 오류 요약.
4. 요청 페이지의 서버 응답 처리(400 `invalid_fields`의 필드 표시, 네트워크 실패 문구)는 로컬 정적 서버로는 확인할 수 없으므로, 필요한 경우 fetch 응답을 흉내 내어 확인한다. 운영 폼으로 시험 제출하지 않는다(운영 R2에 기록이 남는다).
