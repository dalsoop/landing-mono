---
title: Troubleshooting
description: Error messages from cuAlign's server, CLI, MCP and chat stream, matched to cause and fix. Search this page for the exact text you got.
order: 10
updated: 2026-09-28
---

# Troubleshooting

Messages are copied from the code. Most are Korean because the UI is. Search for the text you got.

## Chat and agent

| You see | Cause | Fix |
|---|---|---|
| `plan_error` with `kind: "nim_auth"`, `NVIDIA API 가 서버의 키를 거부했습니다 (HTTP 401/403). 서버의 NVIDIA_API_KEY 를 확인하세요.` | No key, or a rejected key | Set `NVIDIA_API_KEY=nvapi-...` in `.env` and restart. Meanwhile use `POST /api/plan` or a replay |
| `plan_error` with `kind: "nim_overload"`, `NVIDIA API가 일시적으로 과부하 상태입니다. 다시 시도해 주세요.` | NIM kept answering 429 or 5xx after the retries (up to 63 s) | Send the same request again |
| `plan_error` with `kind: "no_answer"`, `모델이 계획 대신 자기 추론문만 돌려보내 답을 만들지 못했습니다. 같은 요청을 다시 보내 주세요.` | The model returned only its reasoning | Send the same request again |
| `plan_error`, `계획은 생성됐으나 최종 선택을 받지 못했습니다.` | The agent made plans but never selected one | Pick one from `GET /api/plans?case_id=...`, or ask again |
| 400 `Invalid case, parent plan or constraints` | Unknown `case_id`, a `base_plan_id` from another case or an older planner, or a bad constraint | Check the ids against `GET /api/cases` and `GET /api/plans` |
| 400 `발치할 치아 번호가 필요합니다(예: 14번과 24번). 앱은 발치 치아를 고르지 않습니다.` | `allow_extraction: true` without teeth | Send `extraction` with the prescribed teeth, or ask the dentist |
| 409 `이전 계산의 계획입니다(계산 코어가 바뀌었습니다). 이 계획을 기준으로 이어갈 수 없으니 다시 계산해 주세요.` from replay, or 400 `Invalid case, parent plan or constraints` from chat | `base_plan_id` points at a plan made by an older planner version (`previous_calculation: true`) | Plan again without it |
| Plan card with review `failed` and approval blocked | The reviewer failed twice or ran out of 40 s | `POST /api/plans/{id}/review` (UI: «검토 다시 요청») |
| `reviewed_by_server: true` | The agent skipped the reviewer, so the server ran it | Nothing to fix. The turn took longer |
| Chat works but Guardrails log `Guardrails OFF` | No key, or `CUALIGN_GUARDRAILS=0` | Set the key. Use `CUALIGN_RAILS_FAIL_CLOSED=1` to refuse instead of running without rails |

## Planning

| You see | Cause | Fix |
|---|---|---|
| `chosen: null` and a `best_failed` | No allowed strategy passed the rules | Read `violations` of `best_failed`, see [Rules](rules.md), change a condition. [Recipe](planning.md#recipe-fix-a-plan-that-fails-the-rules) |
| `unsupported` with an empty `tried` | The scan can't be planned (gap, fewer than 6 teeth, extreme rotation) | See [Scans](scans.md#what-gets-rejected) |
| 400 `소구치(4, 5, 12, 13) 발치만 계획할 수 있습니다: [n]` | Extraction of a non-premolar | Only FDI 14, 15, 24, 25 (Universal 5, 4, 12, 13) |
| 400 `발치할 치아를 고정할 수 없습니다: [5]` | The same tooth in `lock` and `extraction` | Remove it from one |
| 400 `IPR 처방 11-21 0.6mm: 접촉면당 최대 0.5mm(치아 면당 0.25mm)를 넘습니다` | More than 0.5 mm at one contact | Lower it |
| 400 `IPR 접촉면은 이웃한 두 치아여야 합니다: 11-22` | The two teeth aren't neighbours | Use adjacent teeth. `ipr_surfaces` is FDI |
| 400 `IPR 접촉면이 두 번 처방되었습니다: 11-21` | The same contact twice | Keep one |
| 400 `IPR 제외 치아에 IPR 이 처방되었습니다: <teeth>` | A prescribed contact touches an `ipr_exclude` tooth | Remove the tooth from `ipr_exclude` or the contact |
| 400 `clear_stage_cap and stage_cap cannot be set together` | Both sent | Send one |
| 400 `constraint refers to a tooth absent from this case` | A tooth number not in the scan, often FDI sent where Universal is expected | `extraction`, `lock`, `ipr_exclude` take Universal 2–15 |
| 400 `입력 확인 전 스캔입니다. 입력 확인 화면에서 치아 번호와 방향을 확인한 뒤 계획하세요.` | The patient scan isn't confirmed | `POST /api/patients/{pid}/scans/{sid}/confirm` |
| A `lock` or other condition you didn't send is in the result | Without `parent_plan_id`, patches stack on the case's constraints | Send `[]` to clear it, or plan from a specific `parent_plan_id` |

## Approval and export

| You see | Cause | Fix |
|---|---|---|
| 400 `의사의 명시적 확인이 필요합니다.` | Body lacks `"confirmed": true` | Send it |
| 409 `규칙 위반 계획은 승인할 수 없습니다.` | The plan has violations | Fix and replan |
| 409 `검토가 완료되지 않았습니다. 검토 실패/미실행 계획은 승인할 수 없습니다.` | Review is `failed`, `not_requested` or `running` | Request a review again, or wait |
| 409 `스캔 번호가 바뀐 뒤의 이전 계획입니다. 새 입력으로 다시 계획하세요.` | The scan was mirrored after this plan | Plan again on the current revision |
| 409 `삭제된 스캔입니다.` | The scan was deleted | Upload again |
| 409 `의사가 현재 계획을 승인한 뒤 내보낼 수 있습니다.` on `stl.zip` | Not approved, or changed since approval | Approve the current plan |
| 500 `내보내기 파일을 만들지 못했습니다: ...` | The zip build failed | Check the server log. The header `X-Cualign-Print-Models` carries the print-model status |
| Zip has no `print_models/*.stl` | No `gingiva.stl` in the case | `print_models/README.txt` says why. Upload a gum scan |

## Scans and patients

See the full table in [Scans](scans.md#what-gets-rejected). Also:

| You see | Cause | Fix |
|---|---|---|
| 409 `화면의 스캔이 최신이 아닙니다(번호가 바뀌었습니다). 입력 확인 화면을 다시 열어 확인하세요.` | `confirm` sent an old `revision` | Read the check again and send its `revision` |
| 409 `지원하지 않는 스캔은 계획용으로 확인할 수 없습니다.` | `unsupported` isn't empty | Fix the files. Nothing to confirm |
| 404 `'unknown patient P9999'` | Wrong patient id | `GET /api/patients` |
| 422 `Field required` at `["body", "files"]` | The multipart field isn't named `files`, or the shell didn't expand the list | Use `-F "files=@11.stl"` per file. In zsh, build an array (see [Scans](scans.md#recipe-upload-my-per-tooth-stl-files)) |

## MCP

| You see | Cause | Fix |
|---|---|---|
| 503 `MCP is disabled: no token is configured` | Neither `CUALIGN_MCP_TOKEN` nor `CUALIGN_MCP_TOKEN_SHA256` is set | Set one and restart |
| 401 `invalid or missing bearer token` | Missing or wrong `Authorization: Bearer` | Check the token. The server compares SHA-256 digests |
| 421 `Invalid Host header` | The `Host` isn't localhost and isn't in `CUALIGN_MCP_ALLOWED_HOSTS` | Add it, with and without the port |
| `MCP error -32001: Request timed out` in the client | `cualign_plan` takes 63–156 s | Raise the client timeout to 120 s or more |
| `{"status": "error", "message": "unknown case nope"}` | Case id not found | `cualign_list_cases`, or the patient case id from the dentist |

## CLI

| You see | Fix |
|---|---|
| `[확인 필요] 발치할 치아 번호를 함께 적어 주세요(FDI, 예: "14번과 24번 발치"). ...` | Name the teeth in FDI |
| `[확인 필요] 발치 치아는 상악 FDI 번호(11~18, 21~28)로 적어 주세요(...)` | You wrote Universal numbers. Use FDI |
| `[확인 필요] 발치할 치아와 금지·변경 표현이 함께 있어 ...` | Write only the prescription |
| `[거부] CLI 초안은 미승인입니다. ...` | `--export` is always refused. Approve in the server and download there |
| `AuthlibDeprecationWarning: authlib.jose module is deprecated` at start | Harmless warning from a NAT dependency |
