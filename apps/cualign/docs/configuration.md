---
title: Configuration
description: Every environment variable cuAlign reads (key, output folder, Guardrails, MCP token and hosts, public URL), with defaults from the code, and where data is written.
order: 9
updated: 2026-09-28
---

# Configuration

`cualign serve` loads `.env` from `apps/cualign-prototype/`. Start from `.env.example`. Never commit a real key.

## Environment variables

Found by searching the source for `os.environ` and `getenv`.

| Variable | Default | Effect |
|---|---|---|
| `NVIDIA_API_KEY` | none | Key for NIM (planner, reviewer, Guardrails, follow-up card). Counted as present when it starts with `nvapi-`, or with `openshell:resolve:env:` inside an OpenShell sandbox. Without it, chat fails and Guardrails turn off |
| `CUALIGN_OUT` | `out` (relative to the working directory) | Where plans (`plans/p*.json`), zips (`stl/`), patients and scans (`patients/`) and anonymous uploads (`uploads/`) go. Plans in `plans/` are loaded again on restart |
| `CUALIGN_CASE_DIR` | none | A folder of Universal-named per-tooth STL files, exposed as case `scan` and used as the default case |
| `CUALIGN_GUARDRAILS` | `1` | `0` turns Guardrails off (logged at ERROR) |
| `CUALIGN_RAILS_FAIL_CLOSED` | off | `1` refuses a turn when a rail errors, and stops startup when there's no key |
| `CUALIGN_RAILS_TIMEOUT` | `25` | Seconds per rail check |
| `CUALIGN_CONTENT_SAFETY_INPUT` | `advisory` | `block` makes the input content-safety check blocking. Otherwise it only flags |
| `CUALIGN_MCP_TOKEN` | none | Bearer token for `/mcp` |
| `CUALIGN_MCP_TOKEN_SHA256` | none | Hex SHA-256 of the token. Takes priority over `CUALIGN_MCP_TOKEN`. Use it in a sandbox where the raw token can't reach the process |
| `CUALIGN_MCP_ALLOWED_HOSTS` | none | Extra `Host` values `/mcp` accepts, comma-separated (`192.168.5.2,192.168.5.2:8443`). `127.0.0.1` and `localhost` are always allowed |
| `CUALIGN_PUBLIC_URL` | `http://localhost:8000` | Base of `ui_url` and `download_url` in MCP results |
| `CUALIGN_TGN_DIR` | none | ToothGroupNetwork checkout for experimental scan segmentation |
| `NAT_TELEMETRY_ENABLED` | set to `0` by `cualign serve` | NAT CLI usage telemetry |
| `NEMO_GUARDRAILS_NO_USAGE_STATS` | set to `1` when Guardrails start | Guardrails usage stats |

When `HTTPS_PROXY`, `https_proxy`, `ALL_PROXY` or `all_proxy` is set, the NIM client's aiohttp sessions go through that proxy (`sandbox_compat.py`, for OpenShell).

## Models and retries

Set in `configs/workflow.yml`, not in environment variables.

| Setting | Value |
|---|---|
| Planner and reviewer model | `nvidia/nemotron-3-super-120b-a12b`, temperature 0 |
| Reviewer | 2 attempts, 20 s per call, 40 s total |
| Follow-up question card | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Stream retries on 429 and 5xx | after 1, 2, 4, 8, 16, 32 s (up to 63 s per model call) |
| Non-stream retries | after 1, 2, 4 s |
| Overload message | `NVIDIA API가 일시적으로 과부하 상태입니다. 다시 시도해 주세요.` |

## Where things are written

```
$CUALIGN_OUT/
  plans/p*.json                 one file per plan, reloaded on start
  stl/<plan_id>.zip             export cache, rebuilt when the approval fingerprint changes
  patients/_ids.json            id counters (ids are never reused)
  patients/P0001/patient.json
  patients/P0001/scans/S1/<tooth>.stl, gingiva.stl, original/
  uploads/<id>/                 POST /api/cases/upload
```

Constraints per case and the step flow live in memory only and reset on restart.
