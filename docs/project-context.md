# Project context

## Purpose

A separate, runnable Reading Queue demonstrating Context Docs during a small real
software change. Workers serves the API and static assets; D1 stores temporary
browser-isolated queues. This is a teaching sandbox, not a private reading service.

## Approved scope and implementation choices

The owner requested a runnable, auto-deployable public GitHub example and a live
Cloudflare demo on October 25, 2026. The coordinator selected Reading Queue, Workers
and D1 as the smallest useful example. R2, authentication and link fetching are
out of scope. Do not fetch submitted URLs. Do not add paid services or credentials
to files. Main website walkthrough remains a preview pending publication direction.

## Current work

The baseline implements adding, marking read/unread, filtering and deletion.
The 16 Worker integration tests passed locally on October 25, 2026 against real
workerd/D1. A Wrangler deployment dry run and local schema migration passed;
`npm audit` reports zero vulnerabilities with the compatible undici override.
These are application checks, not a Context Docs agent evaluation.

JSON export remains pending. The [requirement](export-requirement.md) and
[decision](decisions.md#export-exercise) own its scope: export the whole active
queue regardless of the UI filter, without session metadata or writes.
Next action: implement that change, test downloads and errors, update context,
then complete the authorized repository publication and Cloudflare deployment.
See the [worked steps](walkthrough.md).

```text
Goal: runnable example and reproducible context handoff
|-- DONE    Implement and test baseline app
|-- READY   Starter state with linked export requirement
|-- NEXT    Implement export, preserve decision and validation evidence
`-- NEXT    Publish app repository, deploy demo, verify CI/CD and website preview
```

## Boundaries

Use synthetic/public example data only. Keep private operator receipts in the
separate notes repo. No claimed agent-benefit evaluation; this is an authored
worked example. Optional event logging is off.
