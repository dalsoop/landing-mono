---
title: Overview
description: What cuAlign does, what it outputs, who approves, and which page to open for each task.
order: 1
updated: 2026-09-28
---

# Overview

cuAlign drafts clear-aligner staging plans for the upper arch. A dentist states the prescription in Korean, for example "비발치, IPR 11-21·11-12·21-22 각 0.4mm" (no extraction, 0.4 mm of IPR at contacts 11-21, 11-12 and 21-22). An agent on NVIDIA NeMo Agent Toolkit turns it into constraints, computes a target arrangement and the stages to reach it, and checks every stage with geometry rules. When a strategy fails the rules it tries the next allowed one. The dentist approves in the web UI, and only then can the per-stage STL files be downloaded.

It's a research prototype. It isn't a medical device and hasn't been clinically validated. Source: <https://github.com/dalsoop/nvidia-hackaton-2026-one/tree/main/apps/cualign-prototype>.

The interface, prescriptions and agent replies are in Korean. English input is not supported yet.

A hosted prototype runs at <https://cualign-proto.external.kr>, with access on request. You can also run it locally with the [Quickstart](quickstart.md).

## What comes out

An approved plan downloads as `cualign_<plan_id>_stages.zip`:

```
stage_01/2.stl … stage_NN/15.stl        one STL per tooth per stage (Universal numbers)
print_models/<case_id>_U_stage01.stl    one printable upper-arch model per stage, only when the case has gingiva.stl
print_models/README.txt
```

These files are for reviewing a plan. They aren't aligner shells.

## Who does what

| Step | Done by |
|---|---|
| Prescription: extraction teeth, IPR contacts, locked teeth, time limit | Dentist |
| Reading the request, choosing strategies, computing stages, rule checks | Planning agent (Nemotron 3 Super on NIM) and cuAlign's geometry code |
| Review memo on the selected plan | Read-only reviewer model, 2 attempts, 40 s total |
| Approval, and with it STL export | Dentist, in the UI or `POST /api/plans/{id}/approval` |

The agent never picks extraction teeth and never approves. The MCP tool `cualign_approve_plan` exists only to refuse.

## Pick a page

| I want to | Page |
|---|---|
| Install, run, and get a first plan | [Quickstart](quickstart.md) |
| Upload my own per-tooth STL files | [Scans](scans.md) |
| Change a prescription, fix a failing plan, approve, download | [Planning](planning.md) |
| Look up a violation type or a limit | [Rules](rules.md) |
| Drive cuAlign from another agent | [Agents](agents.md) |
| Look up an endpoint | [HTTP API](api.md) |
| Look up a CLI command | [CLI](cli.md) |
| Set an environment variable | [Configuration](configuration.md) |
| Decode an error message | [Troubleshooting](troubleshooting.md) |
| Know what it can't do | [Limits](limits.md) |
