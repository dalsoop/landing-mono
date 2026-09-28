# landing-mono

랜딩 페이지를 모아 두는 모노레포입니다. 사이트 하나가 `apps/<사이트>/` 폴더 하나이고, 폴더 안의 파일을 빌드 없이 그대로 서빙합니다.

## 배포

`apps/<사이트>/` 폴더 하나가 `https://<사이트>.external.kr` 하나입니다. `main` 에 푸시하면 `.github/workflows/deploy.yml` 이 모든 사이트를 Cloudflare Pages 프로젝트 `landing-mono` 하나로 배포하고, 폴더마다 `<사이트>.external.kr` 도메인을 프로젝트에 연결합니다.

- 배포할 때 `apps/<사이트>/` 는 `/<사이트>/` 경로로 모이고, `router/_worker.js` 가 요청의 호스트 이름을 보고 그 폴더의 파일을 돌려줍니다. 없는 경로는 그 사이트의 `404.html` 을 돌려줍니다.
- DNS 는 `*.external.kr` 와일드카드 하나가 `landing-mono.pages.dev` 를 가리킵니다(host-infra `dns/cloudflare/zones/external.kr.yaml`). 사이트를 추가할 때 DNS 를 따로 만들지 않습니다. 이미 레코드가 있는 서브도메인은 그 레코드가 우선이므로, 같은 이름의 폴더를 만들면 그 사이트는 열리지 않습니다.
- `https://landing-mono.pages.dev/<사이트>/` 로도 볼 수 있습니다.

## 새 사이트 추가

1. `apps/<사이트>/index.html` 을 만듭니다. 폴더 이름은 소문자·숫자·하이픈만 씁니다.
2. `main` 에 푸시합니다. 몇 분 뒤 `https://<사이트>.external.kr` 이 열립니다.

## 저장소 설정

배포 워크플로에는 저장소 시크릿 두 개가 필요합니다.

- `CLOUDFLARE_API_TOKEN`: 계정 권한 `Cloudflare Pages: Edit` 을 가진 API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 id

| 사이트 | 도메인 |
|---|---|
| [cualign](apps/cualign) | https://cualign.external.kr |
