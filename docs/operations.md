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

로컬 정적 서버에는 Worker가 없으므로 `/eula`처럼 확장자 없는 경로, 사이트 `404.html`, `POST /_forms/…`는 운영과 다르게 동작한다. 양식은 로컬에서 제출하지 말고 아래 스모크 테스트로 확인한다.

## 합치기 전 검사

저장소 루트에서 실행한다. 각 명령의 종료 코드가 0이어야 한다.

```sh
( for f in router/*.js apps/*/*.js; do node --check "$f" || exit 1; done )
( for dir in apps/*/; do
    site=$(basename "$dir")
    echo "$site" | grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' || { echo "bad name: $site"; exit 1; }
    [ -f "$dir/index.html" ] || { echo "no index.html: $site"; exit 1; }
    if [ -f "$dir/forms.json" ]; then
      jq -e 'type == "object" and (keys | all(test("^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$")))' "$dir/forms.json" >/dev/null || { echo "bad forms.json: $site"; exit 1; }
    fi
  done )
```

`apps/cualign/docs/*.md`를 고쳤다면 `apps/cualign/`에서 `apps/cualign/docs/README.md`의 두 `node -e` 명령(llms 생성, 상대 링크 확인)을 차례로 실행하고, 생성된 `llms.txt`, `llms-full.txt`를 같은 커밋에 넣는다. `router/`를 고쳤다면 Worker를 가짜 `ASSETS`, `FORMS` 바인딩으로 불러 상태 코드를 확인하는 스모크 테스트도 저장소 루트에서 돌린다. 모든 줄이 `ok`이고 종료 코드가 0이어야 한다.

```sh
node --input-type=module -e '
import worker from "./router/worker.js";
import fs from "node:fs";
const forms = fs.readFileSync("apps/cualign/forms.json", "utf8");
const puts = [];
const env = {
  ASSETS: { fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (p === "/_forms/cualign.json") return new Response(forms);
    if (p === "/cualign/eula.html") return new Response(null, { status: 307, headers: { location: "/cualign/eula" } });
    if (p === "/cualign/404") return new Response("not found page");
    return new Response("", { status: 404 });
  } },
  FORMS: { put: async (key, value) => { puts.push([key, JSON.parse(value)]); } },
};
const H = "https://cualign.external.kr";
const ok = { name: "A", email: "a@b.co", organization: "O", role: "Researcher", ack_research: "yes", ack_contact: "yes" };
const post = (body, headers = {}) => worker.fetch(new Request(H + "/_forms/demo-request", { method: "POST",
  headers: { "content-type": "application/json", accept: "application/json", origin: H, ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body) }), env);
const cases = [
  ["redirect prefix", worker.fetch(new Request(H + "/eula.html"), env), 307, (r) => r.headers.get("location") === "/eula"],
  ["site 404 page", worker.fetch(new Request(H + "/nope"), env), 404],
  ["unknown host", worker.fetch(new Request("https://example.com/"), env), 404],
  ["valid json", post(ok), 200],
  ["honeypot", post({ ...ok, website: "x" }), 200],
  ["other origin", post(ok, { origin: "https://evil.example" }), 403],
  ["invalid fields", post({ ...ok, email: "x", role: "Boss" }), 400],
  ["too large", post(JSON.stringify({ message: "a".repeat(17000) })), 413],
  ["unknown form", worker.fetch(new Request(H + "/_forms/nope", { method: "POST", headers: { origin: H } }), env), 404],
  ["forms.json hidden", worker.fetch(new Request(H + "/_forms/cualign.json"), env), 404],
  ["plain form 303", worker.fetch(new Request(H + "/_forms/demo-request", { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: H }, body: new URLSearchParams(ok).toString() }), env), 303,
    (r) => r.headers.get("location") === "/request/thanks"],
];
let bad = 0;
for (const [name, pending, status, extra] of cases) {
  const r = await pending;
  const pass = r.status === status && (!extra || extra(r));
  if (!pass) bad++;
  console.log(pass ? "ok  " : "FAIL", name, r.status);
}
if (puts.length !== 2 || puts.some(([k, v]) => !k.startsWith("cualign/demo-request/") || "ip" in v)) { bad++; console.log("FAIL stored records", puts.length); }
process.exit(bad ? 1 : 0);
'
```

## 배포

1. 브랜치에서 커밋하고 GitHub PR을 만든다.
2. 합치기 전 검사를 통과시킨 뒤 PR을 `main`에 합친다.
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
