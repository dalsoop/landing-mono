---
title: Quickstart
description: Install cuAlign, plan a sample case from the CLI or HTTP API, and run it with or without an NVIDIA API key.
order: 2
updated: 2026-09-28
---

# Quickstart

You need Python 3.12, [uv](https://docs.astral.sh/uv/) and git. Every command below runs in `apps/cualign-prototype/`. The outputs are copied from a run on macOS arm64 without an NVIDIA API key.

## Install

```sh
git clone https://github.com/dalsoop/nvidia-hackaton-2026-one.git
cd nvidia-hackaton-2026-one/apps/cualign-prototype
uv sync --frozen --extra dev
```

The CLI reads configs and bench files from the checkout, so a standalone wheel install won't run the server.

## Recipe: first plan from the CLI (no key)

`cualign plan` reads a short Korean prescription with fixed rules and plans a case. No model is called.

```sh
uv run cualign plan "발치 없이 12개월 안에, 앞니 먼저" --case moderate
```

```
[요청] 발치 없이 12개월 안에, 앞니 먼저
[제약] {"extraction": [], "months": 12, "stage_cap": 52, "order": "anterior_first", "ipr_surfaces": null}
[시도] expansion       28장  6.4개월  실패 {'space_deficit': 1}
[시도] ipr             13장  3.0개월  실패 {'space_deficit': 1, 'collision': 36}
[시도] expansion_ipr   27장  6.2개월  통과
[결과] expansion_ipr · 27장 · 6.2개월 · plan p3a8a85fa
[완료] 5.3s · 이 계획은 초안입니다. 최종 판단은 의사가 합니다.
```

"12개월" became a cap of 52 stages (`round(12 × 30.4 / 7)`). Expansion alone left a space deficit, IPR alone added 36 collisions, and expansion plus IPR passed. See [CLI](cli.md) for the sentences it understands.

## Recipe: start the server

```sh
cp .env.example .env          # put your key in NVIDIA_API_KEY, or leave it empty
uv run cualign serve --host 127.0.0.1
```

Open <http://localhost:8000/ui/>. The UI is in Korean and loads three.js from a CDN. `GET /health` answers `{"status":"healthy"}` once it's up.

Without a key the server still starts. The log says:

```
ERROR - cualign.server.rails_middleware:428 - cuAlign: Guardrails OFF (NVIDIA_API_KEY is not set) — every turn runs without rails
```

## Recipe: first plan over HTTP (no key)

Open a sample case, then ask the rule engine for a plan. `poseidon-000131` is a real upper scan whose prescription is non-extraction with 0.4 mm IPR at 11-21, 11-12 and 21-22.

```sh
curl -s -X POST localhost:8000/api/cases/poseidon-000131/activate
```

```json
{"case_id": "poseidon-000131", "n_teeth": 14, "crowding_mm": 1.6,
 "constraints": {"extraction": [], "lock": [], "ipr_exclude": [], "ipr_limit_mm": 0.25,
                 "ipr_surfaces": [[7, 8, 0.4], [8, 9, 0.4], [9, 10, 0.4]],
                 "stage_cap": null, "order": "simultaneous", "allow_extraction": false},
 "active_plan": null, "flow": null, "unsupported": []}
```

```sh
curl -s -X POST localhost:8000/api/plan -H 'content-type: application/json' \
  -d '{"case_id": "poseidon-000131"}'
```

```json
{"case_id": "poseidon-000131",
 "chosen": {"plan_id": "pe2399cd3", "parent_plan_id": null, "strategy": "ipr",
            "n_stages": 9, "months": 2.1, "passed": true, "violations": 0, "by_type": {},
            "review": {"status": "skipped", "attempts": 0, "message": "규칙 폴백 — 검토 에이전트 미실행", "error": null},
            "approval": null, "input_stale": false, "previous_calculation": false, "...": "..."},
 "tried": [{"plan_id": "pe2399cd3", "strategy": "ipr", "n_stages": 9, "passed": true, "...": "..."},
           {"plan_id": "...", "strategy": "expansion_ipr", "...": "..."}]}
```

`review.status` is `skipped` because no reviewer ran. A skipped review can still be approved. To approve and download, follow [Planning: approve and download](planning.md#recipe-approve-and-download-the-stl-zip).

## Recipe: run without an NVIDIA API key

What works and what doesn't, from a keyless run:

| Feature | Without a key |
|---|---|
| `cualign plan`, `POST /api/plan`, the UI button «에이전트 없이 계산» | Works |
| Recorded answers for the three samples, `POST /api/cases/{id}/replay` | Works |
| Scan upload, input check, approval, STL export | Works |
| Chat, `POST /chat/stream`, MCP `cualign_plan` | Fails with `plan_error` kind `nim_auth` |
| Follow-up question card, `POST /api/followup` | Returns `{"question": null}` |
| Guardrails | Off, logged at ERROR |

Replaying a recorded agent turn gives you the agent's words and a recomputed plan with no model call:

```sh
curl -s -X POST localhost:8000/api/cases/poseidon-000001/replay \
  -H 'content-type: application/json' -d '{"step": "stages"}'
```

```json
{"recorded": true, "step": "stages", "recorded_at": "2026-09-27T23:55:02+00:00",
 "answer_md": "**확장 + IPR 전략으로 46단계(약 10.6개월) 계획을 만들었습니다.** 규칙 위반은 없습니다. ...",
 "plan_selected": {"plan_id": "pf6bf5447", "parent_plan_id": null,
                   "review": {"status": "passed", "attempts": 1, "message": "검토 메모 ...", "rails": "passed"}},
 "plans": [{"plan_id": "pa81930ad", "strategy": "ipr", "n_stages": 41, "passed": false, "...": "..."},
           {"plan_id": "pf6bf5447", "strategy": "expansion_ipr", "n_stages": 46, "passed": true, "...": "..."}]}
```

## Recipe: run with a key

Put a key from build.nvidia.com in `.env` as `NVIDIA_API_KEY=nvapi-...` and restart `cualign serve`. The chat panel and `POST /chat/stream` then run the planning agent. Not run for these docs, which were written against a keyless server.

## Docker

```sh
git archive HEAD:apps/cualign-prototype | docker build -t cualign:local -
docker run --rm -p 127.0.0.1:8000:8000 --env-file .env cualign:local
```

Not run for these docs. The build only includes committed files. Plans and STL files live inside the container and vanish with `--rm`.
