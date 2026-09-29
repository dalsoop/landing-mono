# router

Cloudflare Worker `landing-mono`의 코드다. 배포 워크플로가 `router/worker.js`를 Worker의 `main`으로 지정하고, 번들 설정 없이 ES 모듈 그대로 올린다.

## 맡는 일

- `worker.js`: 요청 호스트 `<사이트>.external.kr`에서 사이트 이름을 뽑아 `ASSETS`의 `/<사이트>/<경로>`를 돌려준다. 3xx 응답의 `Location`에서 `/<사이트>` 접두어를 떼고, 자산 404는 `/<사이트>/404`(사이트의 `404.html`) 본문에 상태 404를 붙여 돌려준다. 경로가 `/_forms/`로 시작하면 `forms.js`의 `handleForm`에 넘긴다.
- `forms.js`: `ASSETS`의 `/_forms/<사이트>.json`에서 폼 설정을 읽어 제출을 검증하고 R2 바인딩 `FORMS`에 `<사이트>/<폼>/<ISO시각>-<uuid>.json`으로 저장한다.

## 맡지 않는 일

- 사이트 내용, 페이지 스크립트, 폼 설정 값(`apps/<사이트>/forms.json`)은 이 폴더의 일이 아니다. 특정 사이트 이름이나 폼 이름을 코드에 넣지 않는다.
- `dist/` 조립, `forms.json` 이동, 라우트와 `wrangler.json` 생성은 `.github/workflows/deploy.yml`의 일이다. 바인딩 이름(`ASSETS`, `FORMS`)이나 버킷 이름을 바꾸려면 워크플로의 `wrangler.json` 생성 부분을 같은 변경에서 고친다.
- 인증, 세션, 쿠키, 메일 발송은 없다. 이런 기능을 더하는 것은 이 Worker의 범위를 바꾸는 일이므로 먼저 사용자에게 묻는다.

## 불변 조건

- `ROOT_DOMAIN`은 `external.kr`이고 워크플로의 `env.ROOT_DOMAIN`과 같아야 한다.
- `SITE_LABEL`은 워크플로의 사이트 이름 정규식과, `FORM_NAME`은 워크플로의 폼 이름 정규식과 같아야 한다.
- 서빙 경로는 항상 `/${site}${pathname}`이다. 사이트 이름을 경로 앞에 붙이지 않고 자산을 묻는 코드를 만들지 않는다. 그렇게 하면 한 사이트의 호스트로 다른 사이트의 파일이나 `/_forms/*.json` 설정을 읽을 수 있게 된다.
- `/_forms/` 경로는 자산으로 넘기지 않는다. 이 분기가 폼 설정 파일을 브라우저에게서 숨긴다.
- 양식 처리 순서는 폼 존재 → 메서드 → Origin → 크기 → 인코딩·본문 → 허니팟 → 필드 검증 → 저장소 확인 → 저장이다. 허니팟과 필드 검증을 Origin 검사보다 앞으로 옮기지 않는다.
- 저장 레코드는 `site`, `form`, `received_at`, `country`, `fields`만 가진다. IP, User-Agent, 요청 헤더를 넣지 않는다. 방문자에게 공개한 개인정보 안내가 이 목록을 약속한다.
- `fields`에 적히지 않은 입력 키는 저장하지 않는다.
- 응답의 `error` 코드와 필드 오류 코드는 사이트의 요청 페이지 스크립트가 해석하는 계약이다. 코드 이름을 바꾸거나 지우지 않는다. 새 코드를 더할 때는 사이트 스크립트의 처리도 같은 변경에서 더한다.
- 사용자 입력을 HTML에 넣을 때는 `escapeHtml`을 거친다.
- 모든 양식 응답에 `cache-control: no-store`를 붙인다.

## 구현 방식

- 외부 패키지 없이 Workers 런타임의 `Request`, `Response`, `URL`, `Headers`, `TextDecoder`, `crypto.randomUUID`만 쓴다. `import`는 `./forms.js` 하나뿐이다.
- 응답 형식은 `Accept` 헤더로 고른다. `application/json`이 들어 있으면 JSON, 아니면 오류는 `errorPage` HTML, 성공은 form-urlencoded 제출일 때만 303 리다이렉트다. 405는 항상 JSON이다.
- `errorPage`는 사이트의 `/styles.css`와 `container`, `btn btn-primary` 클래스를 빌려 쓴다.
- 본문 크기는 `content-length` 선언과 실제 바이트 수를 둘 다 16KB와 비교한다.

## 테스트

테스트 러너는 없다. 이 폴더를 고치면 저장소 루트에서 다음을 확인한다.

1. `node --check router/worker.js && node --check router/forms.js`
2. 가짜 `ASSETS`(자산 응답을 흉내 내는 `fetch`)와 가짜 `FORMS`(`put`을 배열에 기록)를 만들어 `worker.fetch(new Request(…), env)`를 직접 부르는 `node --input-type=module -e` 스모크 테스트. 최소한 다음 경우의 상태 코드를 확인한다.
   - `/eula.html` → 307, `Location: /eula`
   - 없는 경로 → 404, 사이트 404 본문
   - `external.kr`이 아닌 호스트 → 404
   - 올바른 JSON 제출 → 200, 저장 1건, 레코드에 IP 없음
   - 허니팟이 채워진 제출 → 200, 저장 없음
   - 다른 Origin → 403, 없는 폼 → 404, GET → 405, 17KB 본문 → 413, `text/plain` → 415
   - 이메일 형식 오류와 허용 값 밖의 `role` → 400 `invalid_fields`와 필드별 코드
   - form-urlencoded 제출 → 303, `Location`이 폼의 `redirect`
   - `GET /_forms/<사이트>.json` → 404 (설정이 새지 않음)
3. 변경 경계: 3xx 응답에 `Location`이 없을 때, `Location`이 다른 사이트 경로일 때(그대로 둔다), 사이트 `404.html`이 없을 때(평문 `Not Found`), `FORMS` 바인딩이 없을 때(503).
