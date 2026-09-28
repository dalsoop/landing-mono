---
title: Rules
description: Every violation type the rule check returns, its fields and usual fix, the numeric limits from the code, and the conditions for approval.
order: 5
updated: 2026-09-28
---

# Rules

Every plan is checked stage by stage. A plan passes when `violations` is empty. Violations show up in three places: `violations` on `GET /api/plans/{id}`, a count per type in `by_type` on every plan summary, and the reviewer's memo.

## Violation types

`stage` is the aligner number (1-based), or `null` for a whole-plan violation. Tooth numbers are Universal.

| `type` | Fields | Fires when | Usual fix |
|---|---|---|---|
| `space_deficit` | `mm`, `limit` | The strategy leaves more than 0.5 mm of crowding unresolved | Next strategy. If extraction is forbidden and nothing passes, report the missing mm |
| `collision` | `stage`, `teeth` [a, b], `overlap_mm3`, `baseline` | Two neighbouring crowns overlap more than 1.0 mm³ beyond their starting overlap | A strategy that makes space first, or another move order |
| `move_limit` | `stage`, `teeth`, `mm`, `limit` | A tooth moves more than 0.25 mm between consecutive aligners | More stages, if the cap allows |
| `rotation_limit` | `stage`, `teeth`, `deg`, `limit` | A tooth turns more than 2.0° between consecutive aligners | More stages, if the cap allows |
| `stage_cap` | `n`, `limit` | The plan has more stages than `stage_cap` | Less total movement, `simultaneous` order, or a looser time limit from the dentist |
| `locked_tooth` | `stage`, `teeth` | A locked tooth moved | Unlock it or pick another strategy |
| `extraction_forbidden` | `teeth` | Teeth were removed without an extraction prescription | Prescribe the teeth or stay non-extraction |
| `extraction_mismatch` | `teeth`, `prescribed`, `removed` | The removed teeth differ from the prescribed ones | Check the prescription |
| `extraction_space_open` | `mm`, `limit` | More than 0.5 mm of extraction space can't be closed, for example because a molar is locked | Unlock teeth around the space |
| `ipr_limit` | `mm`, `limit` | IPR per surface exceeds `ipr_limit_mm` | Raise the limit (max 0.25) or add space another way |
| `ipr_excluded` | `teeth` | IPR landed on a tooth in `ipr_exclude` | Remove it from the list or use another strategy |
| `ipr_unprescribed` | `surfaces`, `teeth` | IPR on a contact or amount the `ipr_surfaces` prescription doesn't name | Check the prescription |

Real example, from a plan capped at 5 stages:

```json
[{"stage": null, "type": "stage_cap", "n": 10, "limit": 5}]
```

## Limits in the code

From `src/cualign/core/limits.py` and `planner.py`. These are PoC settings, not patient-specific clinical values.

| Constant | Value | Used for |
|---|---|---|
| `MAX_LINEAR_PER_ALIGNER` | 0.25 mm | `move_limit` |
| `MAX_ROTATION_PER_ALIGNER` | 2.0° | `rotation_limit` |
| `MAX_ANGULAR_PER_ALIGNER` | 1.0° | Defined, not enforced (translation-only staging) |
| `IPR_PER_SURFACE` | 0.25 mm | Cap of `ipr_limit_mm`. A contact is two surfaces, so 0.5 mm per contact |
| `MAX_EXPANSION_PER_SIDE` | 2.0 mm | Arch expansion |
| `EXTRACTION_THRESHOLD_MM` | 8.0 mm | Space deficit above which extraction is worth considering |
| `SPACE_DEFICIT_TOLERANCE_MM` | 0.5 mm | `space_deficit`, `extraction_space_open` |
| `NEW_OVERLAP_MM3` | 1.0 mm³ | `collision` |
| `ROTATION_MIN_DEG` | 3.0° | Smallest rotation the planner corrects |
| `VERTICAL_MIN_MM` | 1.0 mm | Smallest height difference from the neighbours it corrects |
| `MD_SEARCH_LIMIT_DEG` | 34.0° | A measured rotation this large makes the scan unsupported |
| `WEAR_DAYS` / `DAYS_PER_MONTH` | 7 / 30.4 | `months = round(n_stages × 7 / 30.4, 1)` and `stage_cap = round(months × 30.4 / 7)` |

Sources the code cites for the clinical numbers: MDPI Applied Sciences 2024 staging review, Nature IJOS 2025 expert consensus, Align Technology 2016 press release.

## Approval conditions

`POST /api/plans/{id}/approval` with `{"confirmed": true}` succeeds only when all of these hold:

| Condition | Error when it fails |
|---|---|
| Body has `"confirmed": true` | 400 `의사의 명시적 확인이 필요합니다.` |
| `violations` is empty | 409 `규칙 위반 계획은 승인할 수 없습니다.` |
| `review.status` is `passed` or `skipped` | 409 `검토가 완료되지 않았습니다. 검토 실패/미실행 계획은 승인할 수 없습니다.` |
| Patient scan confirmed | 409 `입력 확인 전 스캔입니다. 입력 확인 화면에서 치아 번호와 방향을 확인한 뒤 계획하세요.` |
| Plan made from the scan's current revision | 409 `스캔 번호가 바뀐 뒤의 이전 계획입니다. 새 입력으로 다시 계획하세요.` |
| Scan not deleted | 409 `삭제된 스캔입니다.` |

A rule pass isn't a clinical judgement. The download checks approval again against a stored fingerprint of the plan, so a changed plan needs a new approval.
