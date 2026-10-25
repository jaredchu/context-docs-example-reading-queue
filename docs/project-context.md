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

The app is live at the [demo URL](https://context-docs-example-reading-queue.viweb.workers.dev).
The [automatic workflow](https://github.com/jaredchu/context-docs-example-reading-queue/actions/runs/40158636168)
tested and deployed `0f68893139bdc8d6dfca218f87410f655b691cc3`. All four served
static files match that source, the health endpoint reports the commit, and live
headless Chrome checks passed for CRUD, isolated queues, persistence, fresh
whole-queue export, empty export and request failure without a file. A first
Python urllib check received HTTP 403; Node fetch and real browser checks passed.
Daily cleanup is configured and locally tested; no daily live cron occurrence
has been observed.

The starter and completed tags preserve the pending requirement and implemented
change. Codex reviewed the Opus baseline; Opus reviewed the integration and one
focused follow-up found no material issues. The [normal-prompt evidence](evidence/README.md)
records a separate observed maintenance outcome and its wording qualification.
The [companion walkthrough](https://context-docs.com/reading-queue/) is now live
from the verified `b38853d` Context Docs website build. Next action for the
upstream maintainer: gather concrete learner feedback. Documentation-only commits do not redeploy
the app or replace the actual deployed source SHA.

See the [worked steps](walkthrough.md).

```text
Goal: runnable example and reproducible context handoff
|-- DONE    Baseline tested; starter revision retained
|-- DONE    Export implemented with requirement and decision preserved
|-- CHECKED 18 integration tests and desktop/mobile browser checks
`-- LIVE    App automatically deployed and verified; companion walkthrough published
```

## Boundaries

Use synthetic/public example data only. Keep operator receipts outside the public project when they contain private
account details. No claimed agent-benefit evaluation; this is an authored
worked example. Optional event logging is off.
