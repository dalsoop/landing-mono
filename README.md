# landing-mono

랜딩 페이지를 모아 두는 모노레포입니다. 사이트 하나가 `apps/<사이트>/` 폴더 하나이고, 폴더 안의 파일을 빌드 없이 그대로 서빙합니다.

## 배포

`main` 에 푸시하면 `.github/workflows/deploy.yml` 이 바뀐 `apps/<사이트>/` 폴더만 골라 Cloudflare Pages 로 배포합니다. 사이트마다 `site.json` 이 배포 대상을 정합니다.

```json
{ "project": "cualign-landing", "domain": "cualign.external.kr" }
```

- `project`: Cloudflare Pages 프로젝트 이름입니다. 없으면 첫 배포 때 만들고, 기본 주소는 `<project>.pages.dev` 입니다.
- `domain`: 사이트에 붙일 도메인입니다. 워크플로가 Pages 프로젝트에 이 도메인을 연결합니다. DNS 레코드(`domain` → `<project>.pages.dev` CNAME)는 도메인을 관리하는 곳에서 따로 만듭니다. `external.kr` 은 host-infra 저장소의 `dns/cloudflare/zones/external.kr.yaml` 에 추가합니다.

전체를 다시 배포하려면 Actions 의 `deploy` 워크플로를 수동 실행합니다. `app` 입력에 폴더 이름을 넣으면 그 사이트만 배포합니다.

## 새 사이트 추가

1. `apps/<사이트>/` 에 `index.html` 과 `site.json` 을 둡니다.
2. DNS 레코드를 추가합니다.
3. `main` 에 푸시합니다.

## 저장소 설정

워크플로에는 저장소 시크릿 두 개가 필요합니다.

- `CLOUDFLARE_API_TOKEN`: 계정 권한 `Cloudflare Pages: Edit` 을 가진 API 토큰
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 id

| 사이트 | 도메인 |
|---|---|
| [cualign](apps/cualign) | https://cualign.external.kr |
