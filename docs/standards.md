# 표준

## 폴더와 이름

- 사이트는 `apps/<사이트>/` 폴더 하나이고, 사이트 이름은 `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`를 만족해야 한다. 어기면 배포 워크플로가 실패하고, 그 커밋의 모든 사이트가 배포되지 않는다.
- 사이트 폴더에는 `index.html`이 있어야 한다. 없으면 같은 방식으로 배포 전체가 실패한다.
- `apps/` 바로 아래에는 사이트 폴더만 둔다. 파일(예: `apps/AGENTS.md`)은 배포 대상이 아니므로 괜찮다. 사이트가 아닌 폴더를 두면 `index.html`이 없어 배포 전체가 실패하거나, 있으면 그 폴더도 사이트로 공개된다.
- `forms.json`은 폼 이름(`^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$`)을 키로 쓰는 JSON 객체여야 한다. 어기면 배포가 실패한다.
- 사이트 폴더에 공개하면 안 되는 파일을 두지 않는다. 빌드 단계가 없어 폴더의 모든 파일이 그대로 공개된다.
- 사이트 안의 링크와 자산 경로는 사이트 루트 기준 절대 경로(`/styles.css`, `/request/`) 또는 상대 경로로 쓴다. `/<사이트>/…`처럼 내부 자산 배치 경로를 쓰지 않는다. 브라우저에서 `/<사이트>/x`는 `apps/<사이트>/<사이트>/x`를 가리켜 404가 된다.

## Worker 코드

- `router/`의 코드는 Cloudflare Workers 런타임의 표준 API(`Request`, `Response`, `URL`, `crypto.randomUUID`)만 쓴다. npm 의존성, 번들러, TypeScript를 들이지 않는다. 워크플로는 `router/worker.js`를 번들 설정 없이 `main`으로 지정한다.
- 사이트별 차이는 코드 분기가 아니라 사이트 폴더의 파일(`forms.json`, `404.html`)로 표현한다. `worker.js`나 `forms.js`에 특정 사이트 이름을 넣지 않는다.
- 양식 오류 응답의 `error` 값(`unknown_form`, `method_not_allowed`, `forbidden_origin`, `too_large`, `unsupported_type`, `bad_body`, `invalid_fields`, `storage_unavailable`)과 필드 오류 값(`required`, `too_long`, `invalid_email`, `invalid_option`)은 사이트의 요청 페이지 스크립트가 해석한다. 이름을 바꾸거나 지우면 같은 변경에서 모든 사이트의 요청 페이지를 고친다.
- 루트 도메인 `external.kr`은 `router/worker.js`의 `ROOT_DOMAIN`과 워크플로의 `env.ROOT_DOMAIN` 두 곳에 있다. 하나만 바꾸면 라우트와 호스트 판별이 어긋나 모든 사이트가 404가 된다.
- 사이트 이름 정규식은 워크플로와 `worker.js`의 `SITE_LABEL`에, 폼 이름 정규식은 워크플로와 `forms.js`의 `FORM_NAME`에 같은 값으로 있어야 한다.

## 사이트 내용 (cualign)

- `eula.html`의 약관 문구를 바꾸면 같은 변경에서 `app.js`의 `EULA_VERSION`과 `eula.html`의 "Version" 표기를 같은 새 날짜로 올린다.
- `docs/*.md`를 고치거나 더하면 `apps/cualign/docs/README.md`의 생성 명령으로 `llms.txt`, `llms-full.txt`를 다시 만들어 같은 커밋에 넣는다. 두 파일을 손으로 고치지 않는다.
- 요청 페이지 입력의 `maxlength`, `required`, `<option>` 값은 `forms.json`의 `max_length`, `required`, `options`와 같아야 한다. 서버가 거절하는 값을 브라우저가 통과시키면 제출이 400이 된다.
- 페이지 경로를 더하거나 바꾸면 `sitemap.xml`을 고친다.
- 단계 캡처(`assets/stages/000001-*.webp`)를 바꾸면 `index.html`의 슬라이더 `max`와 `app.js`의 충돌 표시 범위(6~12단계)를 새 캡처에 맞춘다.

## 커밋과 브랜치

- 기본 브랜치는 `main`이고, `main`의 커밋은 곧바로 운영에 배포된다. 변경은 브랜치(지금까지는 `draft/<사이트>-<주제>`)에서 만들고 GitHub PR로 합친다. `main` 보호 규칙은 GitHub에 설정되어 있지 않으므로 이 규칙은 사람과 에이전트가 지킨다.
- 커밋 제목은 `<type>(<범위>): <한국어 설명>` 형식이다. 범위는 사이트 이름(`cualign`)이나 `router`를 쓰고, 저장소 전체 변경은 범위를 생략한다.
- 스테이징은 경로를 명시해서 한다. `git add -A`, `git commit -a`를 쓰지 않는다.
- `wrangler.json`, `dist/`, `.wrangler/`, `node_modules/`는 커밋하지 않는다(`.gitignore`에 있다). `wrangler.json`은 배포 때마다 워크플로가 만든다.

## 합치기 전 로컬 검사

GitHub Actions에는 배포 잡만 있고 PR 검사는 없다. PR을 합치기 전에 저장소 루트에서 다음을 실행해 모두 종료 코드 0이어야 한다. Node 22 이상과 jq가 필요하다.

```sh
# 1) Worker와 브라우저 스크립트 문법
( for f in router/*.js apps/*/*.js; do node --check "$f" || exit 1; done )

# 2) 사이트 이름, index.html, forms.json 형식 (배포 워크플로의 build 단계와 같은 조건)
( for dir in apps/*/; do
    site=$(basename "$dir")
    echo "$site" | grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' || { echo "bad name: $site"; exit 1; }
    [ -f "$dir/index.html" ] || { echo "no index.html: $site"; exit 1; }
    if [ -f "$dir/forms.json" ]; then
      jq -e 'type == "object" and (keys | all(test("^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$")))' "$dir/forms.json" >/dev/null || { echo "bad forms.json: $site"; exit 1; }
    fi
  done )

# 3) cualign 문서: 상대 링크 확인 후 llms 파일 재생성, 차이가 없어야 한다
( cd apps/cualign && node -e '
const fs = require("fs"), path = require("path"); let bad = 0;
for (const f of fs.readdirSync("docs").filter(f => f.endsWith(".md") && f !== "README.md")) {
  for (const [, href] of fs.readFileSync("docs/" + f, "utf8").matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    if (!fs.existsSync(path.join("docs", href.split("#")[0]))) { console.log(f, "->", href); bad++; }
  }
}
process.exit(bad ? 1 : 0);
' )
# apps/cualign/docs/README.md의 생성 명령을 apps/cualign에서 실행한 뒤:
git diff --exit-code -- apps/cualign/llms.txt apps/cualign/llms-full.txt
```

`router/`를 고쳤다면 다음 스모크 테스트도 종료 코드 0이어야 한다. 가짜 `ASSETS`, `FORMS` 바인딩으로 Worker를 직접 불러 리다이렉트 접두어 제거, 사이트 404, 양식 상태 코드, 저장 레코드를 확인한다. 네트워크와 Cloudflare 계정이 필요 없다.

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

기대 결과가 바뀌는 변경(상태 코드, 리다이렉트 대상, 저장 키)을 했다면 스모크 테스트의 기대값도 같은 변경에서 고친다.
