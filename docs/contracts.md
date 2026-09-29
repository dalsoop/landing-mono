# 외부 계약

이 저장소가 외부에 내놓는 인터페이스는 두 가지다. 사이트 URL 규칙과 양식 제출 엔드포인트 `POST /_forms/<폼>`이다. 둘 다 인증이 없다.

## 사이트 URL

| 요청 | 응답 |
|---|---|
| `GET https://<사이트>.external.kr/<경로>`, 파일이 있음 | 200, `apps/<사이트>/<경로>` 파일 |
| `GET …/<이름>.html` | 307, `Location: /<이름>` (확장자 없는 경로가 정식 주소) |
| `GET …/<폴더>` (끝 슬래시 없음) | 307, `Location: /<폴더>/` |
| `GET …/<없는 경로>` | 404, 본문은 그 사이트의 `404.html`. 없으면 `text/plain` `Not Found` |
| 라우트가 붙지 않은 `*.external.kr` 호스트 | 이 Worker가 응답하지 않는다(2026-09-30 기준 Cloudflare 523) |

정적 자산이 만든 리다이렉트의 `Location`이 `/<사이트>` 접두어로 시작하면 Worker가 그 접두어를 떼어 사이트 루트 기준 경로로 바꾸고, 쿼리와 해시는 유지한다. 접두어로 시작하지 않는 `Location`은 바꾸지 않고 그대로 보낸다.

cualign 사이트가 공개하는 기계용 진입점은 다음과 같다.

| 경로 | 내용 |
|---|---|
| `/llms.txt` | 에이전트용 문서 목록(`## Docs`의 `- [제목](URL): 설명` 줄) |
| `/llms-full.txt` | 모든 문서를 순서대로 이은 한 파일. 문서마다 `<!-- source: <URL> -->` 줄이 앞에 붙는다 |
| `/docs/<이름>.md` | 문서 원본 Markdown(front matter 포함) |
| `/docs/` | 사람용 문서 뷰어. `#/<이름>` 또는 `#/<이름>/<앵커>`로 문서를 연다 |
| `/sitemap.xml`, `/robots.txt` | 검색 엔진용. 모든 경로 크롤링 허용 |

## `POST /_forms/<폼>`

모든 사이트 호스트에서 쓸 수 있다. `<폼>`은 그 사이트의 `forms.json`에 있는 이름이어야 한다.

### 요청

- 헤더 `Origin`: 반드시 `https://<사이트>.external.kr`. 브라우저가 같은 사이트 페이지에서 보내면 자동으로 붙는다.
- 본문: `application/json`(값이 문자열·숫자·불리언·null인 평평한 객체) 또는 `application/x-www-form-urlencoded`. 최대 16KB.
- 헤더 `Accept`에 `application/json`이 들어 있으면 JSON 응답, 없으면 브라우저용 응답(리다이렉트나 HTML)을 받는다.
- JSON 본문의 `true`는 `"yes"`로 바뀐다. 체크박스 필드는 `"yes"` 문자열이나 `true`로 보낸다.

cualign `demo-request` 요청 예:

```http
POST /_forms/demo-request HTTP/1.1
Host: cualign.external.kr
Origin: https://cualign.external.kr
Content-Type: application/json
Accept: application/json

{"name":"A","email":"a@example.com","organization":"Clinic","role":"Researcher","country":"KR","message":"","ack_research":"yes","ack_contact":"yes","website":""}
```

### 성공 응답

| 조건 | 응답 |
|---|---|
| `Accept: application/json` | 200, `{"ok":true}` |
| JSON 본문인데 `Accept`에 JSON 없음 | 200, `{"ok":true}` |
| form-urlencoded 본문, `Accept`에 JSON 없음 | 303, `Location: <폼의 redirect, 기본 />` |

허니팟 필드 `website`가 채워진 제출도 똑같이 성공 응답을 받지만 저장되지 않는다. 모든 응답에 `cache-control: no-store`가 붙는다.

### 오류 응답

JSON 응답 모양은 `{"ok":false,"error":"<코드>","message":"<영어 안내>"}`이고, `invalid_fields`만 `fields`가 더 붙는다. `Accept`에 JSON이 없으면 같은 상태 코드로 "Form not sent" 제목과 `message`를 담은 HTML 페이지를 받는다. 예외는 405로, 항상 JSON이다.

| 상태 | `error` | 조건 |
|---|---|---|
| 404 | `unknown_form` | 폼 이름이 규칙에 맞지 않거나 그 사이트의 `forms.json`에 없음 |
| 405 | `method_not_allowed` | POST가 아님. `Allow: POST` 헤더가 붙고 `message`는 없다 |
| 403 | `forbidden_origin` | `Origin`이 없거나 사이트 origin과 다름 |
| 413 | `too_large` | 본문이 16KB 초과 |
| 415 | `unsupported_type` | 본문 형식이 JSON도 form-urlencoded도 아님 |
| 400 | `bad_body` | JSON 파싱 실패, 객체가 아님, 값이 텍스트로 바꿀 수 없는 형식 |
| 400 | `invalid_fields` | 필드 규칙 위반. `fields`는 `{ "<필드>": "<오류>" }` |
| 503 | `storage_unavailable` | 저장소 바인딩 없음. 나중에 다시 보내야 한다 |

필드 오류 값은 `required`, `too_long`, `invalid_email`, `invalid_option` 네 가지이고 필드마다 하나만 온다.

```json
{"ok":false,"error":"invalid_fields","fields":{"ack_contact":"required","email":"invalid_email","role":"invalid_option"},"message":"Check these fields: ack_contact, email, role."}
```

R2 쓰기 자체가 실패하면 Worker 예외로 Cloudflare 기본 5xx 응답이 나가며, 위 JSON 모양을 따르지 않는다.

### 멱등성

같은 내용을 두 번 보내면 기록이 두 건 저장된다. 재시도해도 안전한 키나 중복 제거는 없으므로, 클라이언트는 200을 받은 뒤 다시 보내지 않는다.
