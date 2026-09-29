# 운영

## 준비

필요한 것: git, Node 22 이상(배포 워크플로가 Node 22를 쓴다), jq. 받은 양식을 조회하거나 지우려면 R2 권한이 있는 Cloudflare API 토큰과 계정 id가 필요하다. 패키지 설치 단계는 없다.

```sh
git clone https://github.com/dalsoop/landing-mono.git
cd landing-mono
node --version   # v22 이상
jq --version
```

## 로컬에서 페이지 보기

빌드가 없으므로 사이트 폴더를 정적 서버로 열면 된다. 사이트 루트 기준 절대 경로(`/styles.css`)를 쓰므로 반드시 사이트 폴더를 서버 루트로 연다.

```sh
cd apps/cualign
python3 -m http.server 8080   # 또는 npx --yes serve -l 8080 .
# http://localhost:8080/ , /request/ , /docs/
```

로컬 정적 서버에는 Worker가 없으므로 `/eula`처럼 확장자 없는 경로, 사이트 `404.html`, `POST /_forms/…`는 운영과 다르게 동작한다. 양식 동작은 로컬 정적 서버로 제출해 보지 말고, 가짜 `ASSETS`·`FORMS` 바인딩으로 Worker를 직접 부르는 스모크 테스트로 확인한다.

## 배포

1. 브랜치에서 커밋하고 GitHub PR을 만든다.
2. 저장소 루트에서 합치기 전 로컬 검사(문법, 사이트 이름·`index.html`·`forms.json` 형식, cualign 문서 링크와 llms 재생성, `router/`를 고쳤다면 Worker 스모크 테스트)를 모두 통과시킨 뒤 PR을 `main`에 합친다.
3. `apps/**`, `router/**`, `.github/workflows/deploy.yml`이 바뀌었으면 `deploy` 워크플로가 자동으로 돈다. 보통 20~30초 걸린다.
4. 확인한다.

```sh
gh run list --repo dalsoop/landing-mono --limit 3          # 최신 실행이 completed success인지
curl -s -o /dev/null -w '%{http_code}\n' https://cualign.external.kr/            # 200
curl -s -o /dev/null -w '%{http_code}\n' https://cualign.external.kr/_forms/cualign.json   # 404 (설정이 새지 않음)
```

다시 배포만 하려면 `gh workflow run deploy --repo dalsoop/landing-mono --ref main`을 쓴다. 배포를 되돌리려면 문제 커밋을 되돌리는 커밋을 `main`에 합친다. 되돌림 커밋도 같은 워크플로로 배포된다.

로컬에서 직접 `wrangler deploy`를 하지 않는다. `dist/`, 라우트 목록, `wrangler.json`, `forms.json` 이동은 워크플로의 build 단계에서만 만들어진다. 이 단계를 손으로 흉내 내다 하나라도 빠뜨리면 사이트 라우트가 사라지거나 폼 설정이 사이트 폴더 안에 남아 공개된다.

## 새 사이트 추가

1. 이름을 정한다. 소문자·숫자·하이픈, 앞뒤는 하이픈이 아니어야 하고, 이미 다른 서비스가 쓰는 `external.kr` 서브도메인과 겹치지 않아야 한다.
2. `apps/<이름>/index.html`을 만든다. 없는 경로에 보여 줄 `404.html`과 `/styles.css`도 두는 편이 낫다(양식 오류 페이지가 `/styles.css`를 쓴다).
3. 양식이 필요하면 `apps/<이름>/forms.json`에 폼을 적고, 폼의 `action`을 `/_forms/<폼>`으로 둔다.
4. PR로 `main`에 합친다. 배포가 끝나면 `https://<이름>.external.kr`이 열린다. DNS 작업은 필요 없다(`*.external.kr` 와일드카드 프록시 레코드가 이미 있다).

## 받은 양식 조회와 삭제

환경 변수 `CF_API_TOKEN`(R2 읽기, 삭제하려면 쓰기 권한 포함)과 `CF_ACCOUNT_ID`를 셸에 둔다. 값은 명령행이나 파일에 남기지 않는다.

```sh
# 목록 (접두어는 <사이트>/<폼>/)
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/r2/buckets/landing-forms/objects?prefix=cualign/demo-request/" \
  | jq -r '.result[] | "\(.last_modified)  \(.key)"'

# 한 건 내용 (키는 목록에서 복사)
CLOUDFLARE_API_TOKEN=$CF_API_TOKEN CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID \
  npx --yes wrangler@4 r2 object get "landing-forms/<키>" --remote --pipe | jq .

# 삭제
CLOUDFLARE_API_TOKEN=$CF_API_TOKEN CLOUDFLARE_ACCOUNT_ID=$CF_ACCOUNT_ID \
  npx --yes wrangler@4 r2 object delete "landing-forms/<키>" --remote
```

삭제 요청("Delete my request" 메시지)을 받으면 그 이메일의 이전 기록과 삭제 요청 기록을 모두 찾아 지우고, 요청자에게 메일로 답한다. 목록 API는 키만 돌려주므로 이메일로 찾으려면 기록 내용을 하나씩 받아 `fields.email`을 비교해야 한다.

## 설정 값

| 이름 | 자리 | 뜻 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub 저장소 시크릿 | 배포 토큰. `Workers Scripts: Edit`(계정), `Workers Routes: Edit`(external.kr zone) |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub 저장소 시크릿 | Cloudflare 계정 id |
| `WORKER_NAME` | 워크플로 `env` | Worker 이름 `landing-mono` |
| `ROOT_DOMAIN` | 워크플로 `env`, `router/worker.js` | `external.kr`. 두 곳을 함께 바꿔야 한다 |
| R2 버킷 `landing-forms` | 워크플로가 만드는 `wrangler.json` | 바인딩 이름 `FORMS`. 버킷은 Cloudflare에 미리 있어야 한다 |
| `CF_API_TOKEN`, `CF_ACCOUNT_ID` | 운영자 셸 | 양식 기록 조회·삭제용 |
| `EULA_VERSION`, `LAUNCH_URL`, `DEMO_FORM_URL` | `apps/cualign/app.js` 상수 | 동의 버전, 프로토타입 주소, 데모 요청 주소(비우면 요청 버튼이 숨는다) |
