---
title: Scans
description: Register a patient, upload per-tooth upper-arch STL files (FDI or Universal names), read the input check, confirm it, and fix swapped left/right numbering.
order: 3
updated: 2026-09-28
---

# Scans

cuAlign plans from one STL file per upper tooth. It doesn't segment a whole-arch scan. Patients and scans are stored on the machine running the server, under `$CUALIGN_OUT/patients/`.

## Recipe: upload my per-tooth STL files

**1. Name the files.** One file per tooth, named by its number, plus an optional `gingiva.stl`:

```
11.stl 12.stl 13.stl 14.stl 15.stl 16.stl 17.stl
21.stl 22.stl 23.stl 24.stl 25.stl 26.stl 27.stl
gingiva.stl
```

If any file is named 17, 18 or 21–28, the whole batch is read as FDI (upper right 18–11, upper left 21–28). Otherwise names are read as Universal 1–16. A batch with only 11–16 is ambiguous and is read as Universal. Names like `000018.stl` are ignored.

**2. Register a patient.** The alias is a pseudonym, at most 40 characters. The memo is at most 200. Neither goes to the model, which sees only the case id.

```sh
curl -s -X POST localhost:8000/api/patients -H 'content-type: application/json' \
  -d '{"alias": "Demo A", "memo": ""}'
```

```json
{"patient_id": "P0001", "alias": "Demo A", "memo": "", "created_at": "2026-09-28T05:46:30+00:00", "scans": [], "last_scan": 0}
```

It fails with 400 `별칭을 입력하세요.` for an empty alias, 400 `별칭에 주민번호·전화번호·이메일 같은 식별정보를 넣지 마세요. 가명만 사용합니다.` for an alias that looks like a phone number, resident number or e-mail, and 422 `string_too_long` past 40 characters.

**3. Upload.** Send every file as a `files` form field in one request.

```sh
cd myscan
args=(); for f in *.stl; do args+=(-F "files=@$f"); done     # zsh or bash
curl -s -X POST localhost:8000/api/patients/P0001/scans "${args[@]}"
```

```json
{"scan_id": "S1", "case_id": "P0001-S1", "arch": "upper", "revision": 1,
 "teeth": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "gingiva": true, "uploaded_at": "...", "confirmed_revision": null, "confirmed_at": null,
 "orientation": {"basis": "gingiva", "side": "ok", "rotation_deg": 0.4, "transform": [["..."]]},
 "check": {"case_id": "P0001-S1", "teeth": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "n_teeth": 14,
           "missing": [], "outside": [], "widths_mm": {"...": "..."}, "crowding_mm": 1.7,
           "rotation_deg": {"7": 15.6}, "vertical_mm": {"7": -1.4}, "scanned_gingiva": true,
           "unsupported": [], "ready": true, "revision": 1, "confirmed": false, "confirmed_at": null}}
```

Tooth numbers in the response are Universal: FDI 11 became 8, FDI 27 became 15. The files were the FDI-renamed teeth of sample `poseidon-000131`.

**4. Read the check.** `ready: true` means the planner can take it. `rotation_deg` and `vertical_mm` list the corrections the planner will make (here FDI 12 turned 15.6° and sitting 1.4 mm off its neighbours). `unsupported` lists why a scan can't be planned. `orientation.side` is `ok` or `reversed`.

**5. Confirm.** Planning, approval and export all refuse an unconfirmed patient scan. Send the revision you checked:

```sh
curl -s -X POST localhost:8000/api/patients/P0001/scans/S1/confirm \
  -H 'content-type: application/json' -d '{"revision": 1}'
```

```json
{"scan_id": "S1", "revision": 1, "confirmed_revision": 1, "confirmed_at": "2026-09-28T05:46:54+00:00", "...": "..."}
```

The case id `P0001-S1` now works everywhere a sample id does. Continue with [Planning](planning.md).

## Recipe: fix swapped left and right

If the check shows the teeth numbered on the wrong side, mirror the numbers:

```sh
curl -s -X POST localhost:8000/api/patients/P0001/scans/S1/mirror
```

The response is a fresh check with `revision` raised by one and `confirmed: false`. Mirroring also removes approval from every plan of that scan, and those plans turn `input_stale: true` for good. Mirroring twice brings the numbers back but not the old plans. In our run a plan from revision 1 stayed stale at revision 3. Confirm the new revision and plan again.

## Recipe: delete a scan or patient

```sh
curl -s -X DELETE localhost:8000/api/patients/P0001/scans/S2     # returns the patient
curl -s -X DELETE localhost:8000/api/patients/P0001              # returns {"deleted", "scans", "plans"} (not run)
```

Both remove the scan's plans and files. Patient and scan ids are never reused.

## What gets rejected

Upload errors, copied from the server:

| HTTP | `detail` | Cause |
|---|---|---|
| 400 | `11.stl: 같은 번호의 파일이 두 개 있습니다.` | Two files map to the same tooth |
| 400 | `31.stl: 하악 번호(31~48)입니다. 지금은 상악 스캔만 받습니다.` | A lower-arch number. Upper arch only |
| 400 | `upper_arch.stl: 한 덩어리 악궁 스캔으로 보입니다. 지금은 치아별로 나뉜 파일(11.stl … 27.stl, 선택 gingiva.stl)만 받습니다. 자동 치아 분리는 실험 단계입니다.` | An STL, PLY or OBJ without a tooth number, and no tooth files |
| 400 | `치아별 STL(<치아번호>.stl, FDI 11~17·21~27)을 한 개 이상 올려 주세요. 잇몸 파일만으로는 계획할 수 없습니다.` | Only `gingiva.stl` was sent |
| 413 | `파일이 너무 큽니다(파일당 60MB, 한 번에 400MB까지).` | Over 60 MB per file or 400 MB per upload |
| 400 | `스캔을 읽지 못했습니다: <ExceptionName>` or `스캔을 읽지 못했습니다: 면이 없거나 넓이가 0인 메시 (<file>)` | A mesh couldn't be read. The scan is discarded |
| 400 | `방향 정렬에 실패했습니다 (<ExceptionName>). 치아 파일이 한 악궁의 것인지 확인하세요.` | Orientation failed, often teeth from different arches |
| 422 | `[{"type": "missing", "loc": ["body", "files"], "msg": "Field required", ...}]` | No `files` field in the form |

An upload can succeed and still be unplannable. Three teeth uploaded fine, and the check came back with:

```json
{"n_teeth": 3, "unsupported": ["치아 3개: 악궁을 맞추기에 부족 (6개 이상 필요)"], "ready": false}
```

The three reasons in `unsupported`:

| Message pattern | Meaning |
|---|---|
| `<teeth>번 결손: 결손 공간이 있는 악궁은 아직 계획하지 않음 (연속된 치열만 지원)` | A gap inside the arch |
| `치아 N개: 악궁을 맞추기에 부족 (6개 이상 필요)` | Fewer than 6 teeth |
| `<tooth>번 회전 ±N°: 측정 범위(±34°) 끝 — 실제로는 더 돌아 있을 수 있음` | Rotation hit the edge of the measurable range |

Confirming an unsupported scan returns 409 `지원하지 않는 스캔은 계획용으로 확인할 수 없습니다.`

## Anonymous folders

`POST /api/cases/upload` takes Universal names only (`2.stl` … `15.stl`, optional `gingiva.stl`) and returns an `upload-xxxxxxxx` case with no patient and no confirmation step. Setting `CUALIGN_CASE_DIR` to a folder of such files exposes it as case `scan`. Only the patient flow has the input check, so prefer it.
