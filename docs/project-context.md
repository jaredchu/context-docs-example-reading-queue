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
to files. The owner also authorized publishing the companion website walkthrough after
validation.

## Current work

The app implements adding, marking read/unread, filtering, deletion and JSON
export. Export fetches the whole active browser queue regardless of the UI
filter, with only title, URL and read state. No schema change or extra service
was needed. The [requirement](export-requirement.md) and
[decision](decisions.md#export-exercise) own that behavior.

On October 25, 2026, all 18 Worker integration tests passed against real local
workerd/D1, including export isolation, physically present expired rows and
row-by-row non-mutation. A Wrangler deployment dry run and local migration passed.
The dependency audit reports zero vulnerabilities with the compatible undici
override. Local headless Chrome checks verified CRUD, persistence, filtering,
fresh full-queue download, empty download, safe text rendering, separate browser
contexts, and failure without a download. Desktop/mobile checks found no page-wide
horizontal overflow. No screen-reader, load or production-abuse assessment ran.
These are application checks, not proof of Context Docs benefit or general
automatic maintenance.

The starter tag retains the pending requirement; the completed tag preserves
this implementation and updated context. Opus reviewed the coordinator's
integration and deployment boundaries; verified findings were resolved before
publication. Next action for the upstream maintainer: publish the example,
verify its automatic Cloudflare deployment and publish the companion walkthrough
after validation. Deployment has not yet been verified at this snapshot.
See the [worked steps](walkthrough.md).

```text
Goal: runnable example and reproducible context handoff
|-- DONE    Baseline tested; starter revision retained
|-- DONE    Export implemented with requirement and decision preserved
|-- CHECKED 18 integration tests and desktop/mobile browser checks
`-- NEXT    Publish, deploy and verify the live app and companion walkthrough
```

## Boundaries

Use synthetic/public example data only. Keep operator receipts outside the public project when they contain private
account details. No claimed agent-benefit evaluation; this is an authored
worked example. Optional event logging is off.
