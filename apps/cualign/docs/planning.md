---
title: Planning
description: Change a prescription and replan, fix a plan that fails the rules, approve it and download the STL zip. Includes the constraint fields and their tooth numbering.
order: 4
updated: 2026-09-28
---

# Planning

All recipes use the rule engine (`POST /api/plan`), which needs no key. With a key, the chat panel and `POST /chat/stream` drive the same constraints and plans through the agent (see [Agents](agents.md)).

## Recipe: change the prescription and replan

Send only what changes, plus `parent_plan_id` to build on a plan. Every other field is inherited from that plan.

```sh
# lock FDI 11 (Universal 8) on top of plan pe2399cd3
curl -s -X POST localhost:8000/api/plan -H 'content-type: application/json' \
  -d '{"case_id": "poseidon-000131", "parent_plan_id": "pe2399cd3", "lock": [8]}'
```

```json
{"chosen": {"plan_id": "p21a525c7", "parent_plan_id": "pe2399cd3", "strategy": "ipr", "n_stages": 9, "passed": true, "...": "..."},
 "best_failed": null,
 "tried": [{"plan_id": "p21a525c7", "strategy": "ipr", "n_stages": 9, "months": 2.1, "passed": true, "by_type": {}, "...": "..."},
           {"plan_id": "p8eae0569", "strategy": "expansion_ipr", "n_stages": 10, "months": 2.3, "passed": true, "by_type": {}, "...": "..."}]}
```

Each request makes new plan ids. Old plans stay, and a new plan never inherits approval.

Without `parent_plan_id` the patch applies to the case's current constraints, and the result becomes the case's constraints. Changes stick. In our run a `lock: [8]` sent earlier was still on `poseidon-000131` two requests later. Opening the case again (`activate`) resets only `stage_cap` and `order`. Clear a list with `[]`:

```sh
curl -s -X POST localhost:8000/api/plan -H 'content-type: application/json' \
  -d '{"case_id": "poseidon-000131", "lock": [], "extraction": []}'
```

## Recipe: fix a plan that fails the rules

Here a stage cap of 5 is too tight for `poseidon-000131`:

```sh
curl -s -X POST localhost:8000/api/plan -H 'content-type: application/json' \
  -d '{"case_id": "poseidon-000131", "parent_plan_id": "pe2399cd3", "stage_cap": 5}'
```

```json
{"chosen": null,
 "best_failed": {"plan_id": "p7b76a665", "strategy": "expansion_ipr", "by_type": {"stage_cap": 1}, "...": "..."},
 "tried": [{"plan_id": "pb418b209", "strategy": "ipr", "n_stages": 9, "months": 2.1, "passed": false, "by_type": {"stage_cap": 1}},
           {"plan_id": "p7b76a665", "strategy": "expansion_ipr", "n_stages": 10, "months": 2.3, "passed": false, "by_type": {"stage_cap": 1}}]}
```

`chosen: null` means no allowed strategy passed. `best_failed` is the one with the fewest violations. Read its violations:

```sh
curl -s localhost:8000/api/plans/p7b76a665 | jq -c .violations
```

```json
[{"stage": null, "type": "stage_cap", "n": 10, "limit": 5}]
```

It can't be approved (`409 규칙 위반 계획은 승인할 수 없습니다.`). Look up the type in [Rules](rules.md), change the condition that caused it, and replan from the failed plan:

```sh
curl -s -X POST localhost:8000/api/plan -H 'content-type: application/json' \
  -d '{"case_id": "poseidon-000131", "parent_plan_id": "p7b76a665", "clear_stage_cap": true}'
```

```json
{"chosen": {"plan_id": "p828b61d7", "parent_plan_id": "p7b76a665", "strategy": "ipr", "n_stages": 9, "passed": true, "...": "..."}, "best_failed": null, "...": "..."}
```

cuAlign never relaxes a condition on its own. Deciding which one to relax is the dentist's call.

## Recipe: approve and download the STL zip

Approval needs `{"confirmed": true}`, zero violations, a review that is `passed` or `skipped`, and, for a patient scan, the confirmed revision the plan was made from.

```sh
curl -s -X POST localhost:8000/api/plans/pe2399cd3/approval \
  -H 'content-type: application/json' -d '{"confirmed": true}'
```

The response is the full plan, with:

```json
"approval": {"status": "approved", "approved_at": "2026-09-28T05:45:32.687865+00:00", "fingerprint": "3188c663...0e87"}
```

Approval starts building the zip in the background. Poll it if you like:

```sh
curl -s localhost:8000/api/plans/pe2399cd3/export-status
# {"building":true,"done":0,"total":9,"ready":false}   right after approval
# {"building":false,"done":9,"total":9,"ready":true}   after the download below
```

Download. The request waits for the build if it isn't done.

```sh
curl -s -D - -o plan.zip localhost:8000/api/plans/pe2399cd3/stl.zip
```

```
HTTP/1.1 200 OK
x-cualign-print-models: ok; files=9
content-disposition: attachment; filename="cualign_pe2399cd3_stages.zip"
```

That zip held 136 files, 60.8 MB: 9 stages × 14 teeth, 9 print models and `print_models/README.txt`. Print models need a `gingiva.stl` in the case. The tooth files carry the prescribed IPR cut.

To withdraw approval: `curl -s -X DELETE localhost:8000/api/plans/pe2399cd3/approval`. The plan comes back with `"approval": null`.

## In the web UI

The UI at `/ui/` is Korean. Pick a case or register a patient («환자 등록»), check the scan, describe the prescription in the chat box, read the plan card and the 3D stages, then approve and download with «확정하고 내려받기». «에이전트 없이 계산» calls the rule engine, «이 조건으로 다시 계산» replans with the form's conditions, and «검토 다시 요청» reruns a missing or failed review. Button labels are from the UI source. These docs didn't drive the UI.

## Constraint fields

The body of `POST /api/plan`, the `constraints` of `/chat/stream` and the MCP tool `cualign_plan` share one schema. `null` or a missing field keeps the current value.

| Field | Type | Numbering | Meaning |
|---|---|---|---|
| `extraction` | list of int, 2–15 | Universal | Teeth to extract. `[]` = non-extraction. Only premolars 4, 5, 12, 13 (FDI 15, 14, 24, 25) |
| `allow_extraction` | bool | | Deprecated. `false` clears `extraction`. `true` without teeth is refused |
| `lock` | list of int, 2–15 | Universal | Teeth that must not move |
| `ipr_exclude` | list of int, 2–15 | Universal | Teeth to leave unstripped under the uniform IPR rule |
| `ipr_limit_mm` | 0–0.25 | | Per tooth surface, uniform rule only |
| `ipr_surfaces` | list of `[tooth, neighbour, mm]` | **FDI** on input, Universal in responses | IPR per contact, split half and half. Only these contacts are stripped. Max 0.5 mm per contact |
| `stage_cap` | int > 0 | | Maximum stages. 12 months = 52 |
| `clear_stage_cap` | bool | | Drops the cap. Can't be sent with `stage_cap` |
| `order` | `simultaneous`, `anterior_first`, `sequential` | | Move order |

`POST /api/plan` also takes `case_id` and `parent_plan_id`.

Which strategies run depends on the prescription:

| Prescription | Strategies tried |
|---|---|
| `extraction` has teeth | `extraction` only |
| `ipr_surfaces` set | `ipr`, `expansion_ipr` |
| Neither | `expansion`, `ipr`, `expansion_ipr` |

Tooth numbering at a glance: FDI 18–11 = Universal 1–8, FDI 21–28 = Universal 9–16. Third molars (1, 16) are never planned.
