# cuAlign docs

`https://cualign.external.kr/docs/` 의 원본입니다. 정본은 이 폴더의 `*.md` 이고, 나머지는 거기서 만듭니다.

- `*.md`: 문서 하나에 파일 하나. 맨 위 front matter 의 `title`, `description`, `order`, `updated` 를 씁니다. 상대 링크는 `.md` 로 겁니다.
- `index.html`: 사람용 화면. `../llms.txt` 의 `## Docs` 목록으로 사이드바를 만들고, `#/<이름>` 의 `.md` 를 받아 marked 로 그린 뒤 DOMPurify 로 정리합니다.
- `../llms.txt`, `../llms-full.txt`: 에이전트 진입점. 손으로 고치지 않고 아래 명령으로 만듭니다.

문서를 고치거나 더한 뒤 `apps/cualign/` 에서 실행합니다.

```sh
node -e '
const fs = require("fs"), B = "https://cualign.external.kr/docs/";
const docs = fs.readdirSync("docs").filter(f => f.endsWith(".md") && f !== "README.md").map(f => {
  const t = fs.readFileSync("docs/" + f, "utf8"), m = t.match(/^---\n([\s\S]*?)\n---\n/);
  const fm = Object.fromEntries(m[1].split("\n").map(l => l.split(/: (.*)/s).slice(0, 2)));
  return { f, t, fm };
}).sort((a, b) => a.fm.order - b.fm.order);
const head = "# cuAlign\n\n> Research prototype that drafts clear-aligner staging plans for the upper arch from a dentist\x27s prescription, checks every stage with geometry rules, and exports per-stage STL files only after the dentist approves.\n\nRuns locally as a FastAPI/NVIDIA NeMo Agent Toolkit server (`uv run cualign serve`, port 8000). The rule engine, scan upload, approval and export work without an NVIDIA API key. The chat agent and MCP planning need one. Tooth numbers: FDI in prescriptions and upload names, Universal (upper 1-16) in API responses.\n";
fs.writeFileSync("llms.txt", head + "\n## Docs\n\n" + docs.map(d => `- [${d.fm.title}](${B}${d.f}): ${d.fm.description}`).join("\n") +
  "\n\n## Optional\n\n- [All docs in one file](https://cualign.external.kr/llms-full.txt): every page above, concatenated in order\n- [Source code](https://github.com/dalsoop/nvidia-hackaton-2026-one/tree/main/apps/cualign-prototype): the cuAlign server, planner and tests\n- [EULA](https://cualign.external.kr/eula): terms of use for the research prototype\n");
fs.writeFileSync("llms-full.txt", head + docs.map(d => `\n<!-- source: ${B}${d.f} -->\n\n` + d.t).join(""));
'
```

확인: 상대 링크가 모두 있는 파일을 가리키는지 봅니다.

```sh
node -e '
const fs = require("fs"), path = require("path"); let bad = 0;
for (const f of fs.readdirSync("docs").filter(f => f.endsWith(".md") && f !== "README.md")) {
  for (const [, href] of fs.readFileSync("docs/" + f, "utf8").matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const p = path.join("docs", href.split("#")[0]);
    if (!fs.existsSync(p)) { console.log(f, "->", href); bad++; }
  }
}
process.exit(bad ? 1 : 0);
'
```

예시는 모두 실제 실행 출력에서 옮겼습니다. cuAlign 코드가 바뀌면 해당 문서의 예시를 다시 실행해 고칩니다.
