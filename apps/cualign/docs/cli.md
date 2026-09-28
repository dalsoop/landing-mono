---
title: CLI
description: The four cualign commands (plan, serve, cases build, bench), every option, the Korean sentences `cualign plan` understands, and its refusal messages.
order: 8
updated: 2026-09-28
---

# CLI

Run from `apps/cualign-prototype/` as `uv run cualign <command>`. All outputs below are from real runs.

| Command | Options | Does |
|---|---|---|
| `cualign plan REQUEST` | `--case` (default `moderate`), `--export` (always refused) | Rule-based plan from a Korean sentence. No model |
| `cualign serve` | `--host` (default `0.0.0.0`), `--port` (default `8000`) | Loads `.env`, then runs `nat serve --config_file configs/workflow.yml` |
| `cualign cases build` | `--out` (default `data/cases`) | Writes the 5 synthetic presets as per-tooth STL folders |
| `cualign bench` | `--out` (default `bench/results.md`) | Runs the strategy ladder on the presets and writes a Markdown table |

`serve` binds to all interfaces by default. Pass `--host 127.0.0.1` on a shared network, since the server has no authentication.

## cualign plan

```sh
uv run cualign plan "14번과 24번 발치로" --case extraction
```

```
[요청] 14번과 24번 발치로
[제약] {"extraction": [5, 12], "months": null, "stage_cap": null, "order": "simultaneous", "ipr_surfaces": null}
[시도] extraction      10장  2.3개월  통과
[결과] extraction · 10장 · 2.3개월 · plan p3aeb0877
[완료] 1.4s · 이 계획은 초안입니다. 최종 판단은 의사가 합니다.
```

`--case` takes a sample id (`poseidon-000097`, `poseidon-000001`, `poseidon-000131`), a preset (`aligned`, `mild`, `moderate`, `severe`, `extraction`) or a folder of per-tooth STL files. The plan is stored like any other and shows up in the server if both use the same `CUALIGN_OUT`.

What the parser reads (`parse_constraints` in `cli.py`):

| Sentence contains | Becomes |
|---|---|
| `14번과 24번 발치`, `14·24 발치`, `발치 치아: 14, 24` | `extraction` [5, 12]. Teeth are FDI |
| `비발치`, `발치 없이`, `발치 금지`, `발치는 싫` | `extraction` [] |
| `발치` alone | Refused: teeth needed |
| `12개월` | `months` 12, `stage_cap` 52 |
| `40장` | `stage_cap` 40, overriding months |
| `앞니 먼저`, `앞니부터`, `총생부터` | `order` `anterior_first` |
| `IPR 11-21·11-12·21-22 각 0.4mm` | `ipr_surfaces` at those FDI contacts, 0.4 mm each |
| `IPR 14-15·24-25부터 앞쪽으로 총 3.6mm` | Every contact from those forward to 11-21, 3.6 mm shared evenly |
| `IPR 11-21·21-22 총 0.8mm` | 0.8 mm shared over the named contacts |

With nothing about extraction, the case's own prescription decides.

```sh
uv run cualign plan "발치 없이 IPR 11-21·11-12·21-22 각 0.4mm" --case poseidon-000131
```

```
[제약] {"extraction": [], "months": null, "stage_cap": null, "order": "simultaneous", "ipr_surfaces": [[7, 8, 0.4], [8, 9, 0.4], [9, 10, 0.4]]}
[시도] ipr              9장  2.1개월  통과
[시도] expansion_ipr   10장  2.3개월  통과
[결과] ipr · 9장 · 2.1개월 · plan p253c0fcc
```

Refusals (exit code 1):

| Input | Message |
|---|---|
| `"발치 허용"` | `[확인 필요] 발치할 치아 번호를 함께 적어 주세요(FDI, 예: "14번과 24번 발치"). 앱은 발치 치아를 고르지 않습니다.` |
| `"5번과 12번 발치로"` | `[확인 필요] 발치 치아는 상악 FDI 번호(11~18, 21~28)로 적어 주세요(예: "14번과 24번 발치").` |
| `"14번과 24번 발치 금지"` | `[확인 필요] 발치할 치아와 금지·변경 표현이 함께 있어 처방을 판단할 수 없습니다. "14번과 24번 발치" 또는 "발치 없이"처럼 처방만 적어 주세요.` |
| any, with `--export out.zip` | `[거부] CLI 초안은 미승인입니다. UI에서 계획 생성·의사 승인 후 다운로드하세요.` |

When every allowed strategy fails, the result line reads `[결과] 허용 전략 전부 실패 — 최선 <strategy> (<by_type>). 조건 완화가 필요합니다.`

## cualign cases build

```sh
uv run cualign cases build --out /tmp/cases
```

```
[cases] aligned     -> /tmp/cases/aligned
[cases] mild        -> /tmp/cases/mild
[cases] moderate    -> /tmp/cases/moderate
[cases] severe      -> /tmp/cases/severe
[cases] extraction  -> /tmp/cases/extraction
```

Took 3.2 s. Each folder holds `2.stl` … `15.stl`.

## cualign bench

```sh
uv run cualign bench --out /tmp/bench.md
```

Took 2 min 20 s here. The table has one row per preset: crowding, the ladder's result with and without extraction, strategies tried, violations caught, and a naive plan for comparison. Numbers change with the planner version, so the committed `bench/results.md` may not match a fresh run.

## cualign serve

```sh
uv run cualign serve --host 127.0.0.1 --port 8000
```

Without `NVIDIA_API_KEY` it prints `[warn] NVIDIA_API_KEY not set — the agent will fail; /ui and the rule-based fallback still work` and starts anyway. The warning goes to stdout right before the process is replaced by NAT, so it may not show when stdout isn't a terminal. It didn't appear in our log file. See [Configuration](configuration.md) for the environment it reads.
