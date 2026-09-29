# 엔지니어링 노트

## 정적 자산 리다이렉트가 내부 경로를 드러낸다

- 증상: `https://cualign.external.kr/eula.html`이 `/cualign/eula`로 리다이렉트되어 404가 났다(2026-09-28, 커밋 `2a40146` 이전).
- 원인: Worker 정적 자산은 `.html` 경로와 끝 슬래시 없는 폴더 경로를 스스로 307 리다이렉트한다. 자산은 `/<사이트>/…`에 모여 있으므로 `Location`에도 그 접두어가 붙는다.
- 대응: `router/worker.js`의 `unprefixRedirect`가 3xx 응답의 `Location`에서 `/<사이트>` 접두어를 뗀다. `serve`를 고칠 때 3xx 분기를 404 분기보다 먼저 두는 순서를 유지한다.
- 확인: `curl -sI https://cualign.external.kr/eula.html`의 `location`이 `/eula`, `curl -sI https://cualign.external.kr/docs`의 `location`이 `/docs/`여야 한다(2026-09-30에 두 값 모두 확인).

## 404 페이지는 확장자 없는 경로로 받아야 한다

- 증상: 없는 경로에 대해 사이트의 `404.html`을 돌려주려고 `/<사이트>/404.html`을 자산에 물으면 404 본문 대신 리다이렉트가 온다.
- 원인: 위와 같은 `.html` 리다이렉트 규칙 때문이다.
- 대응: `serve`는 `/<사이트>/404`를 묻고, 받은 본문과 헤더로 상태만 404인 새 응답을 만든다. 사이트의 `404.html`은 어느 깊이의 경로에서도 보이므로 그 안의 CSS·이미지 경로를 `/styles.css`처럼 사이트 루트 기준 절대 경로로 쓴다. 상대 경로를 쓰면 `/a/b/c` 같은 깊은 경로의 404에서 스타일이 깨진다.

## 양식 오류 HTML은 사이트의 `/styles.css`를 빌려 쓴다

- `router/forms.js`의 `errorPage`는 `/styles.css`와 `container`, `btn btn-primary` 클래스를 가정한다. cualign에는 이 파일과 클래스가 있지만, 새 사이트가 양식을 받으면서 `styles.css`가 없으면 JavaScript 없이 제출했다가 실패한 방문자가 스타일 없는 페이지를 본다. 새 사이트에 양식을 붙일 때는 이 경로를 브라우저에서 한 번 열어 확인한다.

## 요청 페이지는 서버 규칙을 브라우저에서 한 번 더 검사한다

- `apps/cualign/request/index.html`의 스크립트는 입력 요소의 `required`, `type="email"`, `maxlength`로 먼저 검사하고, 서버의 `invalid_fields` 응답의 `fields`를 같은 오류 문구로 보여 준다. 서버에만 있는 규칙(허용 값 `options`)은 `<select>`의 선택지로만 맞춰져 있다.
- `forms.json`의 규칙만 바꾸고 HTML 속성을 그대로 두면, 브라우저는 통과시키고 서버는 400을 돌려준다. 보통은 서버가 보낸 필드 오류가 입력칸 옆에 보인다. 그런데 서버가 오류를 붙인 필드에 해당하는 입력 요소나 `data-error-for` 문단이 페이지에 없으면 `showErrors`가 예외를 던지고, 방문자는 원인 없이 "We could not send your request…" 문구만 본다. 새 필드는 `forms.json`, 입력 요소와 오류 문단, `LABELS` 세 곳에 함께 더한다.

## llms 파일은 생성물이고 순서는 front matter가 정한다

- `apps/cualign/llms.txt`와 `llms-full.txt`는 `apps/cualign/docs/README.md`의 `node -e` 명령이 `apps/cualign/docs/*.md`의 front matter(`title`, `description`, `order`)로 만든다. `apps/cualign/docs/README.md`는 목록에서 빠진다.
- 에이전트 문서 뷰어 `apps/cualign/docs/index.html`은 사이드바를 `../llms.txt`의 `## Docs` 목록에서 만든다. 새 `.md`를 추가하고 `llms.txt`를 다시 만들지 않으면 뷰어 목록에도 나타나지 않는다.
- front matter는 `---\n` 줄바꿈이 정확해야 한다. CRLF로 저장하면 생성 명령의 정규식이 front matter를 찾지 못해 `TypeError`로 멈춘다.
- 확인: 생성 명령 실행 뒤 `git diff --exit-code -- apps/cualign/llms.txt apps/cualign/llms-full.txt`. 2026-09-30에는 차이가 없었다.

## 히어로 3D는 조용히 사라진다

- `app.js`는 `prefers-reduced-motion`, WebGL 미지원, 모듈 로드 실패(cdnjs 장애, `hero-case.json` 404) 중 하나라도 걸리면 3D 자리를 비워 두고 오류를 표시하지 않는다. 로딩 포스터 이미지도 2026-09-28에 뺐다. 히어로가 비어 보이면 먼저 브라우저 콘솔과 네트워크 탭에서 three.js와 `assets/hero-case.json` 요청을 확인한다.
- `hero-case.json`의 치아 키와 `removed`는 Universal 번호 문자열(`"5"`, `"12"`)이다. FDI 번호(14, 24)를 넣으면 발치 치아가 표시되지 않고 오류도 나지 않는다.
- 트레이 효과(`hero-fx.js`)는 `hero3d.js`가 넘긴 `toothPose`와 단계 수 `n`만 쓰고, 트레이 수는 `TRAYS = 6`으로 고정이다. 단계 수가 6으로 나누어떨어지지 않아도 트레이 위치는 소수 단계로 보간된다.
- 드래그 회전은 정밀 포인터(마우스)에서만 켜진다. 터치 기기에서는 해상도 배율을 1로 낮추고 안티앨리어싱을 끈다.

## 배포는 사이트 하나의 실수로 전부 멈춘다

- 증상: 한 사이트 폴더의 이름이나 `forms.json`이 규칙을 어기면 `deploy` 잡이 `::error::`로 끝나고, 같은 커밋의 다른 사이트 변경도 운영에 나가지 않는다.
- 대응: 합치기 전에 워크플로의 build 단계와 같은 검사를 로컬에서 돌린다. 실패한 배포 뒤에는 고친 커밋을 다시 `main`에 합치거나 Actions에서 `workflow_dispatch`로 다시 돌린다.

## 문서만 바꿔도 배포가 돈다

- 워크플로의 `paths` 필터는 `apps/**`, `router/**`다. `apps/AGENTS.md`, `router/AGENTS.md`, 사이트 README만 바꾼 커밋도 전체 재배포를 일으킨다. 자산 내용이 같으면 운영 동작은 바뀌지 않는다. 사이트 폴더 안의 문서는 재배포와 함께 공개 경로에도 올라간다.
