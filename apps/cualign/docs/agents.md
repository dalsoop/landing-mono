---
title: For agents
description: Call cuAlign from another agent through its MCP server at /mcp (5 tools, bearer token) or through /chat/stream SSE, with the call order, real tool results, and what an agent must never do.
order: 6
updated: 2026-09-28
---

# For agents

cuAlign exposes itself two ways. `/mcp` is a Streamable HTTP MCP server with five tools, built for a front-desk agent such as OpenClaw in a NemoClaw sandbox. `/chat/stream` is the NAT chat endpoint the web UI uses. Both reach the same planning agent, so both need `NVIDIA_API_KEY` on the server for planning.

## Rules for a calling agent

- Send the dentist's words in Korean as `request`. Don't compute stages, movements or months yourself, and don't change the numbers cuAlign returns.
- Never pick extraction teeth. If extraction is allowed but no teeth are named, ask the dentist.
- Never approve or export. Approval is the dentist's, in the UI (`ui_url`). `cualign_approve_plan` always refuses. `cualign_export_stl` only returns a link after the dentist approved.
- Never send patient names, contact details or scan files. Tools see case ids like `P0001-S1`. Scans enter through the UI or the [scan API](scans.md).
- Call `cualign_plan` once per request. It takes 63–156 s per call in the project's own measurements (not remeasured here). Set your MCP client timeout to at least 120 s. On `status: "error"`, report the message and don't loop.

## Recipe: connect to the MCP server

Start the server with a token. Any of these is enough:

```sh
CUALIGN_MCP_TOKEN=<token> uv run cualign serve --host 127.0.0.1
# or, where the raw token can't reach the process (OpenShell sandbox):
CUALIGN_MCP_TOKEN_SHA256=$(printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1) uv run cualign serve
```

With neither set, `/mcp` answers 503 `MCP is disabled: no token is configured`. The UI and HTTP API don't need the token.

Every request carries `Authorization: Bearer <token>` and `Accept: application/json, text/event-stream`. Sessions are stateless and answers are plain JSON:

```sh
curl -s -X POST http://127.0.0.1:8000/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

```json
{"protocolVersion": "2025-06-18", "serverInfo": {"name": "cualign", "version": "1.30.0"},
 "instructions": "cuAlign drafts clear-aligner staging plans for a dentist. Call cualign_list_cases first, then cualign_plan with the case and the dentist's request. Every plan is a draft: the dentist reviews and approves it in the cuAlign UI (ui_url), never through these tools."}
```

(`result` only, from the real response.) Hosts other than `127.0.0.1` and `localhost` must be listed in `CUALIGN_MCP_ALLOWED_HOSTS`, or the server answers 421 `Invalid Host header`. Links in tool results use `CUALIGN_PUBLIC_URL`, default `http://localhost:8000`.

## Recipe: run the whole flow from an agent

Tool results arrive as JSON text in `result.content[0].text`. The results below come from a keyless server, so `cualign_plan` fails and the plan was made with `POST /api/plan` instead.

**1. List cases.**

```json
// tools/call cualign_list_cases {}
{"active": "P0001-S1",
 "cases": [{"case_id": "poseidon-000097", "kind": "sample", "...": "..."},
           {"case_id": "poseidon-000001", "kind": "sample"}, {"case_id": "poseidon-000131", "kind": "sample"},
           {"case_id": "aligned", "kind": "synthetic"}, {"case_id": "mild", "kind": "synthetic"},
           {"case_id": "moderate", "kind": "synthetic"}, {"case_id": "severe", "kind": "synthetic"},
           {"case_id": "extraction", "kind": "synthetic"}]}
```

Patient scans aren't listed. Take the patient case id (`P0001-S1`) from the dentist.

**2. Plan.**

```json
// tools/call cualign_plan {"case_id": "poseidon-000131", "request": "처방대로 단계 계획을 짜 주세요."}
{"status": "error", "answer": "", "tools": [], "note": "초안입니다. 최종 판단과 승인은 의사가 cuAlign 화면에서 합니다.",
 "message": "NVIDIA API 가 서버의 키를 거부했습니다 (HTTP 401/403). 서버의 NVIDIA_API_KEY 를 확인하세요."}
```

With a key, `status` is `planned`, `answer` holds the agent's Korean answer, `tools` the tool names it called, and `plan` the same summary `cualign_get_plan` returns, plus `reviewed_by_server`. `no_plan` means the turn ended without selecting one (a question back, for example). This path wasn't run, because no key was available.

**3. Read the plan.**

```json
// tools/call cualign_get_plan {"plan_id": "p63215c9e"}
{"plan_id": "p63215c9e", "case_id": "P0001-S1", "parent_plan_id": null, "strategy": "ipr", "n_stages": 9, "months": 2.1,
 "passed": true, "violations": 0, "by_type": {}, "constraints": {"...": "..."},
 "review": {"status": "skipped", "...": "..."}, "approval": null, "input_stale": false, "previous_calculation": false,
 "reviewer_memo": "규칙 폴백 — 검토 에이전트 미실행", "ui_url": "http://localhost:8000/ui/?plan=p63215c9e"}
```

Report strategy, stage count, months, pass or violation counts, the reviewer memo verbatim, and `ui_url`.

**4. Hand approval to the dentist.** Both tools refuse until the dentist acts:

```json
// tools/call cualign_approve_plan {"plan_id": "p63215c9e"}
{"status": "refused", "approval": null, "ui_url": "http://localhost:8000/ui/?plan=p63215c9e",
 "message": "승인은 의사가 cuAlign 화면에서만 할 수 있습니다."}

// tools/call cualign_export_stl {"plan_id": "p63215c9e"}   before approval
{"status": "refused", "message": "의사가 현재 계획을 승인한 뒤 내보낼 수 있습니다.", "ui_url": "http://localhost:8000/ui/?plan=p63215c9e"}
```

**5. After the dentist approved in the UI:**

```json
// tools/call cualign_export_stl {"plan_id": "p63215c9e"}
{"status": "approved", "download_url": "http://localhost:8000/api/plans/p63215c9e/stl.zip"}
```

Unknown ids come back as `{"status": "error", "message": "unknown plan pnope"}` or `unknown case nope`.

## MCP tools

| Tool | Arguments | Returns |
|---|---|---|
| `cualign_list_cases` | none | `cases`, `active` |
| `cualign_plan` | `case_id` (required), `request` (required, Korean), `constraints` (optional, see [constraint fields](planning.md#constraint-fields)), `base_plan_id` (optional, revise this plan) | `status` (`planned`, `no_plan`, `error`), `answer`, `tools`, `note`, `plan`, `reviewed_by_server`, `message` |
| `cualign_get_plan` | `plan_id` | Plan summary with `reviewer_memo` and `ui_url` |
| `cualign_approve_plan` | `plan_id` | Always `status: "refused"` with `ui_url` |
| `cualign_export_stl` | `plan_id` | `download_url` once approved, else `refused` |

`cualign_plan` activates the case, then posts to the server's own `/chat/stream`, so Guardrails, the reviewer and the server context apply as they do for the UI. It waits up to 600 s.

In NemoClaw, the tool names get a `cualign__` prefix (`cualign__cualign_plan`) and the policy denies `cualign_approve_plan` and `cualign_export_stl` again at the proxy. Setup: `docs/nemoclaw.md` in the repository.

## Recipe: call /chat/stream directly

The body is NAT's chat request plus a `cualign` object and an optional `step`:

```json
{"messages": [{"role": "user", "content": "처방대로 단계 계획을 짜 주세요."}],
 "cualign": {"case_id": "poseidon-000131", "request_id": "optional, 1-128 chars",
             "base_plan_id": null, "constraints": {}},
 "step": "stages"}
```

`step` is `setup` (read the prescription into constraints and stop), `target` (make a target arrangement and stop) or `stages` (the default: plan, select, review). Send `Accept: text/event-stream`.

After NAT's own frames, cuAlign appends its events at the end of the stream. From a keyless run:

```
{"code":"workflow_error","message":"NVIDIA API 가 서버의 키를 거부했습니다 (HTTP 401/403). 서버의 NVIDIA_API_KEY 를 확인하세요.","details":"RuntimeError"}

event: plan_error
data: {"request_id": "abfa24bc15f44bf2bb384683c73533f6", "case_id": "poseidon-000131", "kind": "nim_auth", "message": "NVIDIA API 가 서버의 키를 거부했습니다 (HTTP 401/403). 서버의 NVIDIA_API_KEY 를 확인하세요."}

event: plan_context
data: {"request_id": "abfa24bc15f44bf2bb384683c73533f6", "case_id": "poseidon-000131", "constraints": {"...": "..."}, "rails": "off"}
```

| Event | When | Payload |
|---|---|---|
| `plan_selected` | The agent selected a plan | `request_id`, `case_id`, `schema_version` 1, `plan_id`, `parent_plan_id`, `review`, `reviewed_by_server` |
| `plan_error` | The turn failed, or plans were made but none selected | `request_id`, `case_id`, `message`, and `kind` when the turn failed (`nim_auth`, `nim_overload`, `no_answer`, `workflow_error`) |
| `plan_context` | Every turn | `constraints` in force, `rails` (`passed`, `flagged`, `off`, `error`, `blocked`) |
| `step_done` | A step finished | `step` plus `constraints` and `conditions_ko` (setup), `target_id` and `summary` (target), `plan_id` and `target_id` (stages) |

A bad `cualign` object is refused before the model runs: 400 `Invalid case, parent plan or constraints`, or 400 with the extraction message when extraction is allowed without teeth. `reviewed_by_server: true` means the agent skipped the reviewer and the server ran it. `kind: "nim_overload"` and `no_answer` (`모델이 계획 대신 자기 추론문만 돌려보내 답을 만들지 못했습니다. 같은 요청을 다시 보내 주세요.`) are worth one resend. `nim_auth` needs a valid key on the server.
