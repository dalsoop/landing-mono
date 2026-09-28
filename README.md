# landing-mono

랜딩 페이지를 모아 두는 모노레포입니다. 사이트 하나가 `apps/<사이트>/` 폴더 하나이고, 폴더 안의 파일을 빌드 없이 그대로 서빙합니다.

## 배포

`apps/<사이트>/` 폴더 하나가 `https://<사이트>.external.kr` 하나입니다. `main` 에 푸시하면 `.github/workflows/deploy.yml` 이 모든 사이트를 Cloudflare Worker `landing-mono` 하나의 정적 자산으로 배포하고, 폴더마다 `<사이트>.external.kr/*` 라우트를 붙입니다.

- 배포할 때 `apps/<사이트>/` 는 `/<사이트>/` 경로로 모이고, `router/worker.js` 가 요청의 호스트 이름을 보고 그 폴더의 파일을 돌려줍니다. 없는 경로는 그 사이트의 `404.html` 을 404 로 돌려줍니다.
- 라우트는 사이트 이름을 정확히 지정하므로 다른 서브도메인의 트래픽은 Worker 를 거치지 않습니다.
- DNS 는 따로 만들지 않습니다. Cloudflare 의 `*.external.kr` 와일드카드 레코드(프록시)가 이미 모든 서브도메인을 Cloudflare 로 보내고, 사이트별 라우트가 그중 해당 이름만 Worker 로 받습니다. 이미 레코드가 있는 서브도메인(immich·cdn·postiz 등)은 그 레코드가 우선이므로, 같은 이름의 폴더를 만들면 그 사이트는 열리지 않습니다.

## 새 사이트 추가

1. `apps/<사이트>/index.html` 을 만듭니다. 폴더 이름은 소문자·숫자·하이픈만 씁니다.
2. `main` 에 푸시합니다. 몇 분 뒤 `https://<사이트>.external.kr` 이 열립니다.

## 양식

모든 사이트는 `POST /_forms/<폼>` 으로 양식 제출을 받을 수 있습니다. 받은 내용은 R2 버킷 `landing-forms` 에 `<사이트>/<폼>/<ISO시각>-<uuid>.json` 으로 저장합니다. 파일에는 필드 값, 받은 시각, Cloudflare 가 판단한 국가가 들어가고, IP 는 저장하지 않습니다.

- 사이트가 받을 폼은 `apps/<사이트>/forms.json` 에 적습니다. 폼 이름을 키로 쓰고 `fields`(받을 필드), `required`, `email`(이메일 형식을 검사할 필드), `options`(허용 값), `max_length`(필드별 최대 길이, 기본 2000자), `redirect`(JavaScript 없이 제출했을 때 303 으로 보낼 경로)를 둡니다. 예시는 [apps/cualign/forms.json](apps/cualign/forms.json) 입니다.
- 배포할 때 이 파일은 사이트 폴더에서 빠져서 `/_forms/<사이트>.json` 으로 옮겨지므로 브라우저에서는 읽을 수 없습니다. `forms.json` 에 없는 폼이나 사이트는 404 입니다.
- 본문은 JSON 이나 form-urlencoded 이고 16KB 를 넘으면 413 입니다. `Origin` 이 그 사이트 자신이 아니면 403 이고, 허니팟 필드 `website` 가 채워져 있으면 저장하지 않고 성공으로 응답합니다.
- `Accept: application/json` 요청은 `{"ok":true}` 나 `{"ok":false,"error":…,"fields":{…}}` 를 받고, JavaScript 없이 제출한 양식은 성공하면 `redirect` 로 303, 실패하면 오류 안내 HTML 을 받습니다.

받은 요청은 다음 명령으로 봅니다. `CF_API_TOKEN` 에는 R2 읽기 권한이 있어야 합니다.

```bash
# 목록
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/r2/buckets/landing-forms/objects?prefix=cualign/demo-request/" \
  | jq -r '.result[] | "\(.last_modified)  \(.key)"'

# 한 건 내용 (키는 위 목록에서 복사)
CLOUDFLARE_API_TOKEN=$CF_API_TOKEN CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID \
  npx --yes wrangler@4 r2 object get "landing-forms/<키>" --remote --pipe | jq .

# 삭제 요청 처리
CLOUDFLARE_API_TOKEN=$CF_API_TOKEN CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID \
  npx --yes wrangler@4 r2 object delete "landing-forms/<키>" --remote
```

## 저장소 설정

배포 워크플로에는 저장소 시크릿 두 개가 필요합니다.

- `CLOUDFLARE_API_TOKEN`: 계정 권한 `Workers Scripts: Edit` 과 external.kr zone 권한 `Workers Routes: Edit` 을 가진 API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 id

| 사이트 | 도메인 |
|---|---|
| [cualign](apps/cualign) | https://cualign.external.kr |
