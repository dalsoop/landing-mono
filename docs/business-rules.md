# 업무 규칙

## 용어

- **사이트**: `apps/` 바로 아래 폴더 하나. 폴더 이름이 곧 사이트 이름이고 서브도메인이다.
- **폼**: 사이트가 받는 양식 하나. 사이트의 `forms.json`에서 키 하나가 폼 하나다. 같은 폼 이름이라도 사이트가 다르면 다른 폼이다.
- **제출 기록**: 저장에 성공한 양식 제출 한 건. R2 객체 하나다.
- **cuAlign**과 **cualign**: cuAlign은 소개하는 제품(치과 투명 교정 단계 계획 연구용 프로토타입)이고, cualign은 이 저장소의 사이트 폴더 이름이다. 제품의 호스팅 프로토타입은 `cualign-proto.external.kr`로 따로 있다.

## 사이트와 도메인

- 사이트 이름은 정규식 `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`를 만족해야 한다. 대문자, 밑줄, 점, 앞뒤 하이픈, 64자 이상은 배포 실패다.
- 사이트 폴더에는 `index.html`이 있어야 한다. 없으면 배포 실패다.
- 사이트 `<이름>`은 `https://<이름>.external.kr`에서만 열린다. `external.kr`이 아닌 호스트나 규칙에 맞지 않는 라벨은 평문 404를 받는다.
- 사이트 안의 경로 `/x`는 `apps/<이름>/x` 파일이다. `a.html`은 `/a`로 307 리다이렉트되고, 폴더 경로 `/docs`는 `/docs/`로 리다이렉트된다.
- 없는 경로는 그 사이트의 `404.html` 내용을 상태 404로 받는다. `404.html`이 없는 사이트는 평문 `Not Found`를 받는다.
- 이미 다른 서비스가 쓰는 서브도메인 이름(`cualign-proto`, `immich`, `cdn`, `postiz` 등)은 사이트 이름으로 쓰지 않는다. 그 이름으로 폴더를 만들면 기존 서비스와 사이트 중 한쪽이 열리지 않는다.
- 폴더를 지우면 다음 배포부터 그 서브도메인은 이 저장소의 사이트로 응답하지 않는다.

## 양식

폼 설정 `apps/<사이트>/forms.json`은 폼 이름을 키로 쓰는 JSON 객체다. 폼 이름은 `^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`다. 각 폼은 다음 키를 가진다.

| 키 | 의미 | 없을 때 |
|---|---|---|
| `fields` | 저장할 필드 이름 목록 | 아무 필드도 저장하지 않는다 |
| `required` | 비어 있으면 안 되는 필드 | 필수 필드 없음 |
| `email` | 이메일 형식을 검사할 필드 | 검사 없음 |
| `options` | 필드별 허용 값 목록 | 제한 없음 |
| `max_length` | 필드별 최대 글자 수 | 필드마다 2000자 |
| `redirect` | JavaScript 없이 제출해 성공했을 때 303으로 보낼 경로 | `/` |

제출 한 건은 다음 순서로 처리한다. 앞 단계에서 걸리면 뒤 단계는 하지 않는다.

1. 폼 이름이 규칙에 맞지 않거나 사이트의 `forms.json`에 없으면 404 `unknown_form`이다.
2. POST가 아니면 405 `method_not_allowed`다.
3. `Origin` 헤더가 요청 URL의 origin(`https://<사이트>.external.kr`)과 정확히 같지 않으면 403 `forbidden_origin`이다. `Origin`이 없어도 403이다.
4. 선언된 길이나 실제 본문이 16KB(16384바이트)를 넘으면 413 `too_large`다.
5. 본문 형식이 `application/json`도 `application/x-www-form-urlencoded`도 아니면 415 `unsupported_type`이다. JSON이 깨졌거나 객체가 아니거나 값이 문자열·숫자·불리언·null이 아니면 400 `bad_body`다.
6. JSON 값 변환: `true`는 `"yes"`, `false`와 `null`은 없는 값, 숫자는 문자열이 된다.
7. 허니팟 필드 `website`에 공백이 아닌 값이 있으면 저장하지 않고 성공과 똑같이 응답한다.
8. `fields`에 적힌 필드만 앞뒤 공백을 자른 뒤 남긴다. 빈 문자열은 없는 값이다. `fields`에 없는 필드는 조용히 버린다.
9. 필드별 오류: 필수인데 없으면 `required`, 길이가 넘으면 `too_long`, 이메일 필드가 `^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$`에 맞지 않으면 `invalid_email`, 허용 값에 없으면 `invalid_option`이다. 한 필드에는 오류 하나만 붙고 길이 검사가 먼저다. 오류가 하나라도 있으면 400 `invalid_fields`이고 아무것도 저장하지 않는다.
10. R2 바인딩이 없으면 503 `storage_unavailable`이다.
11. 저장 키는 `<사이트>/<폼>/<ISO 8601 UTC 시각>-<무작위 UUID>.json`이고, 내용은 `site`, `form`, `received_at`, `country`(Cloudflare가 판단한 국가 코드, 없으면 null), `fields`뿐이다. IP 주소, User-Agent, 허니팟 값은 저장하지 않는다.

같은 사람이 여러 번 제출하면 기록이 여러 건 생긴다. 중복을 합치거나 막는 처리는 없다.

## cualign 사이트

### 데모 요청 폼 `demo-request`

- 받는 필드: `name`, `email`, `organization`, `role`, `country`, `message`, `ack_research`, `ack_contact`.
- 필수: `name`, `email`, `organization`, `role`, `ack_research`, `ack_contact`. `country`와 `message`는 선택이다.
- `role`은 `Orthodontist`, `General dentist`, `Dental technician`, `Researcher`, `Other` 중 하나다.
- `ack_research`(연구용 프로토타입이며 임상용이 아님을 이해함)와 `ack_contact`(연락 동의)는 값이 `yes`여야 한다.
- 최대 길이: `name` 200자, `email` 254자, `organization` 300자, `country` 100자, 나머지는 2000자다.
- JavaScript 없이 제출해 성공하면 `/request/thanks`로 간다.
- 요청 검토와 로그인 정보 발송은 사람이 손으로 한다. 자동 승인이나 자동 메일은 없다.
- 기록 삭제 요청은 같은 이메일로 폼을 다시 보내 마지막 칸에 "Delete my request"라고 쓰는 방식이다. 운영자가 그 이메일의 기록을 찾아 지우고 메일로 답한다. 이 요청 자체도 새 제출 기록으로 저장된다.

### 프로토타입 실행 전 동의

- "Launch prototype" 버튼은 EULA 동의가 있어야 `https://cualign-proto.external.kr/`로 이동한다.
- 동의 창의 두 확인란(연구·시연 용도로만 쓴다, 식별 가능한 환자 데이터를 올리지 않는다)이 모두 체크되어야 "Agree & continue"가 켜진다.
- 동의는 브라우저 `localStorage`의 `cualign.eula`에 `{version, acceptedAt}`으로 남는다. 저장된 `version`이 `app.js`의 `EULA_VERSION`과 같으면 다시 묻지 않고 바로 이동한다. 다르거나 없거나 저장소를 쓸 수 없으면 매번 다시 묻는다.
- EULA 문구를 바꾸면 버전을 올려 모든 방문자에게 다시 동의를 받는다. 현재 버전은 `2026-09-28`이다.

### 페이지 내용

- 제품에 관한 문장은 cuAlign 저장소의 README, `docs/OVERVIEW.md`, `docs/NVIDIA_STACK.md`, `docs/VERIFICATION.md`, `evals/`에 적힌 사실만 옮긴다. 그 문서의 범위나 한계가 바뀌면 페이지도 함께 고친다.
- 페이지는 cuAlign이 의료기기가 아니고 임상 판단에 쓰면 안 되는 연구용 프로토타입이라고 밝혀야 한다. 이 고지를 빼거나 약하게 바꾸지 않는다.
- 랜딩 화면의 문구와 예시 처방은 영어다. 프로토타입 인터페이스가 한국어라는 사실은 FAQ "What do I need to run it?" 답의 한 줄과 `apps/cualign/docs/`의 문서에만 둔다.
- 단계 슬라이더는 샘플 케이스 000001의 계획 19장(0~18단계)을 보여 주고, 6~12단계에는 "collision flagged"를 붙인다. 이 범위는 캡처 이미지에 충돌이 빨갛게 보이는 단계와 같다.
- 히어로 3D는 샘플 케이스 `poseidon-000097`의 발치 계획(27단계, 규칙 통과, 발치 치아 Universal 5·12 = FDI 14·24)을 되풀이해 보여 준다. 다른 케이스로 바꾸면 cuAlign이 실제로 계산하고 규칙을 통과한 결과여야 한다.
- 공개 에이전트 문서는 `apps/cualign/docs/*.md`가 정본이고 `llms.txt`, `llms-full.txt`는 그 파생물이다. 두 파일을 손으로 고치지 않는다.
