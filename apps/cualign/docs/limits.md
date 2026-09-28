---
title: Limits
description: What cuAlign doesn't do (lower arch, torque, most rotations, auth, clinical validation), what's unverified, and the terms of use.
order: 11
updated: 2026-09-28
---

# Limits

Read this before trusting a plan or exposing the server.

## Clinical scope

- Upper arch only. Lower-arch files are refused at upload.
- Teeth are translated. Rotation is corrected only for the four incisors (FDI 12, 11, 21, 22), and a crown more than 1 mm above or below its neighbours is levelled. Canine, premolar and molar rotation, torque, angulation, occlusion and tissue response aren't modelled.
- Extraction works for premolars only, and only the teeth the dentist names.
- The arch must be continuous with at least 6 teeth. A gap inside the arch makes the scan unsupported. Third molars are never planned.
- Whole-arch scans aren't segmented. Upload one STL per tooth.
- Months are `stages × 7 / 30.4`, a fixed 7-day wear period. They don't predict treatment time.
- Collision checks cover neighbouring crowns' convex hulls. They don't guarantee zero contact between every pair.
- IPR is applied to the tooth meshes in the exported files, as a computed cut. It isn't a clinical stripping protocol.
- A rule pass isn't a clinical judgement. The outputs are review files, not aligners or validated production models.

## Software

- No user authentication and no per-user isolation. `/mcp` has a bearer token. Everything else is open to whoever can reach the port. Run on localhost or a trusted network.
- Case constraints and the step flow live in memory and reset on restart. Plans, patients and scans persist in `CUALIGN_OUT`.
- The web UI is Korean only and loads three.js from a CDN.
- Guardrails check chat input and output on every agent route. They don't filter the progress events or the raw steps of `/v1/workflow/full` and `/v1/workflow/atif`. On a rail error the turn proceeds with an ERROR log unless `CUALIGN_RAILS_FAIL_CLOSED=1`. The personal-data filter catches resident numbers, phone numbers and e-mail addresses, not names or chart numbers.
- A plan request makes several model calls. If one of them fails after its retries, the whole request fails.

## Not verified for these docs

- A successful agent turn over `/chat/stream` or MCP `cualign_plan`. No key was available, so only the failure path was run.
- The web UI flow. Button names come from the UI source.
- Docker, OpenShell and NemoClaw setups. See `docs/openshell.md` and `docs/nemoclaw.md` in the repository for the project's own records.

## Data and terms

The three sample cases are upper-arch scans from Poseidon3D (Kubik & Spanel 2024, CC-BY-4.0), with prescriptions a dentist wrote for them. Tooth templates used by the synthetic presets carry their own CC-BY 4.0 attribution in the repository.

Terms of use: [End User License Agreement](../eula.html). Source code: <https://github.com/dalsoop/nvidia-hackaton-2026-one/tree/main/apps/cualign-prototype>.
