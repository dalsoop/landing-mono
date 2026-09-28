---
title: HTTP API
description: Every route in server/api.py with method, body, main response fields and error codes, plus /mcp, /chat/stream and the NAT routes. Default base URL http://localhost:8000.
order: 7
updated: 2026-09-28
---

# HTTP API

Base URL `http://localhost:8000`. JSON in, JSON out. Errors come as `{"detail": "..."}`, with the Korean message the UI shows. Body validation errors are FastAPI's 422 with a `detail` list. There is no authentication except on `/mcp`, and no per-user isolation. Run it on a trusted machine.

"Run" marks the routes called for these docs. The rest are described from `src/cualign/server/api.py`.

## Cases

| Method and path | Body or query | Response | Errors | Run |
|---|---|---|---|---|
| `GET /api/cases` | | `cases` and `active`. Samples carry `prescription`, `request` and `constraints`, synthetic presets carry `crowding_mm`, and a `scan` row appears when `CUALIGN_CASE_DIR` is set | | yes |
| `GET /api/case-list` | | `cases`: one row per sample and patient scan with `status` (`scan_check`, `plan_needed`, `violation`, `awaiting_approval`, `approved`), `status_ko`, `plan` (representative plan: newest approved, else newest), `n_plans` | | yes |
| `POST /api/cases/{case_id}/activate` | | `case_id`, `n_teeth`, `crowding_mm`, `constraints`, `active_plan`, `flow`, `unsupported` | 404 unknown case | yes |
| `GET /api/cases/{case_id}/check` | | Input check: `teeth`, `n_teeth`, `missing`, `outside`, `widths_mm`, `crowding_mm`, `rotation_deg`, `vertical_mm`, `scanned_gingiva`, `unsupported`, `ready`, plus `orientation`, `revision`, `confirmed`, `confirmed_at` for patient scans | 404 | yes |
| `GET /api/cases/{case_id}/mesh` | `?plan_id=`, `?target_id=` | Viewer data: `teeth`, `ids`, `arch`, `arch_order`, `gum`, `gum_filled`, `gum_fill`, `teeth_cut`, `ipr_cut`, `plan_id`, `name` | 404 | yes |
| `GET /api/cases/{case_id}/gum` | | `gum`, `gum_filled`, `gum_fill` | 404 | yes |
| `GET /api/cases/{case_id}/targets/{target_id}` | | A target shaped like a one-stage plan: `stages`, `rotations`, `pivots`, `info`, `summary`, `constraints`, `violations: []` | 404 `목표 배열이 없습니다` | yes |
| `GET /api/cases/{case_id}/targets/{target_id}/cut` | | `plan_id: null`, `target_id`, `teeth_cut`, `ipr_cut` | 404 | yes |
| `POST /api/cases/upload` | multipart `files`, Universal names | `case_id` (`upload-xxxxxxxx`), `n_teeth`, `crowding_mm` | 400 when no tooth file | yes |
| `POST /api/cases/{case_id}/replay` | `{"step": "setup" \| "target" \| "stages" \| "plan" \| "cap" \| "compare", "base_plan_id": null}` | `recorded`, `step`, `answer_md`, `recorded_at`, `plan_selected`, `plans`, and per step `constraints`, `conditions_ko` or `target_id`, `summary` | 404 `녹화된 답이 없습니다` (samples only), 400 bad constraints, 409 base plan from an older core | yes |

## Patients and scans

| Method and path | Body | Response | Errors | Run |
|---|---|---|---|---|
| `GET /api/patients` | | `patients` with `n_scans` | | yes |
| `POST /api/patients` | `{"alias": "≤40 chars", "memo": "≤200 chars"}` | `patient_id` (`P0001`), `alias`, `memo`, `created_at`, `scans`, `last_scan` | 400 empty alias or personal data, 422 too long | yes |
| `GET /api/patients/{pid}` | | Patient with `scans`, each with a `plans` count | 404 | yes |
| `DELETE /api/patients/{pid}` | | `deleted`, `scans`, `plans` (counts removed) | 404 | no |
| `POST /api/patients/{pid}/scans` | multipart `files`: `<tooth>.stl`, optional `gingiva.stl` | Scan (`scan_id`, `case_id`, `arch`, `teeth`, `gingiva`, `orientation`, `revision`, `confirmed_revision`, ...) plus `check` | 400, 404, 413, 422. See [Scans](scans.md#what-gets-rejected) | yes |
| `POST /api/patients/{pid}/scans/{sid}/confirm` | `{"revision": N}` (optional) | The scan with `confirmed_revision`, `confirmed_at` | 404, 409 unsupported scan, 409 stale revision | yes |
| `POST /api/patients/{pid}/scans/{sid}/mirror` | | A new check. Bumps `revision`, clears approval of that scan's plans | 404 | yes |
| `DELETE /api/patients/{pid}/scans/{sid}` | | The patient | 404 | yes |

## Plans

| Method and path | Body or query | Response | Errors | Run |
|---|---|---|---|---|
| `POST /api/plan` | [Constraint fields](planning.md#constraint-fields) plus `case_id`, `parent_plan_id` | `case_id`, `chosen` (first passing plan or `null`), `tried` (one summary per strategy), `best_failed` (when nothing passed), or `unsupported` with an empty `tried` | 400 with the constraint or input message | yes |
| `GET /api/plans` | `?case_id=` | `plans`: summaries, newest first | | yes |
| `GET /api/plans/{plan_id}` | | Full plan: `plan_id`, `case_id`, `parent_plan_id`, `strategy`, `constraints`, `stage_cap`, `stages` (per stage, `{"<tooth>": [x, y, z]}` displacement in mm), `rotations` (degrees), `pivots`, `target`, `info`, `violations`, `passed`, `review`, `approval`, `input_revision`, `input_stale`, `previous_calculation` | 404 `unknown plan <id>` | yes |
| `GET /api/plans/{plan_id}/cut` | | `plan_id`, `teeth_cut`, `ipr_cut` (`{"<tooth>": {"mm", "faces"}}`) | 404 | yes |
| `POST /api/plans/{plan_id}/approval` | `{"confirmed": true}` | Full plan with `approval: {status, approved_at, fingerprint}`. Starts the zip build | 400, 404, 409. See [Rules](rules.md#approval-conditions) | yes |
| `DELETE /api/plans/{plan_id}/approval` | | Full plan with `approval: null` | 404 | yes |
| `GET /api/plans/{plan_id}/export-status` | | `building`, `done`, `total`, `ready` | 404 | yes |
| `GET /api/plans/{plan_id}/stl.zip` | | The zip. Header `X-Cualign-Print-Models: <status>; files=<n>[; reason=...]` | 404, 409 not approved or stale input, 500 build failed | yes |
| `POST /api/plans/{plan_id}/review` | | Full plan after a new review | 404, 409 `미실행이거나 실패한 검토만 다시 요청할 수 있습니다.` (only `not_requested` or `failed` can be retried), 503 `검토 모델이 연결되지 않았습니다.` | 409 only |

Plan summary fields (in `tried`, `chosen`, `GET /api/plans` and MCP): `plan_id`, `case_id`, `parent_plan_id`, `strategy`, `n_stages`, `months`, `passed`, `violations` (count), `by_type`, `constraints`, `review`, `approval`, `input_stale`, `previous_calculation`.

`review.status` is one of `not_requested`, `running`, `passed`, `failed`, `skipped`. `previous_calculation: true` marks a patient plan made by an older planner version. It's listed but can't be a base plan.

## Chat, MCP and other

| Method and path | Notes | Run |
|---|---|---|
| `POST /chat/stream` | NAT chat with cuAlign's `cualign` context and events. See [Agents](agents.md#recipe-call-chatstream-directly) | keyless only |
| `POST /mcp` (also GET, DELETE) | MCP Streamable HTTP, bearer token. See [Agents](agents.md) | yes |
| `POST /api/followup` | `{"messages": [...]}` (≤200) → `{"question": {...} \| null}`. Suggested next question card. Never fails the screen | yes (`null`) |
| `GET /health` | `{"status": "healthy"}` | yes |
| `GET /` | 307 to `/ui/` | yes |
| `GET /ui/` | The web UI (static files) | yes |
| NAT routes | `/chat`, `/v1/chat`, `/v1/chat/stream`, `/v1/chat/completions`, `/generate`, `/generate/stream`, `/generate/full`, `/v1/workflow`, `/v1/workflow/stream`, `/v1/workflow/full`, `/v1/workflow/atif`, `/executions/...`, `/evaluate/item`, `/auth/redirect`. They run the same workflow with Guardrails, but only `/chat/stream` adds the case context and plan events | listed from `/openapi.json` |
