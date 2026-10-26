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

The [live demo](https://context-docs-example-reading-queue.viweb.workers.dev)
was automatically tested and deployed from `0f68893` on October 25. The
[publication record](evidence/publication-2026-10-25.md) retains the workflow,
source verification, browser checks, collaboration history and diagnostic limits.
The [ordinary-prompt case](evidence/README.md) separately records observed context
maintenance and its wording qualification. The
[companion walkthrough](https://context-docs.com/reading-queue/) remains published
from the verified `ee9211e` website cleanup build on October 26; the initial
`b38853d` publication remains in the historical record.

On October 26, the owner requested a local preview of targeted teaching and
navigation fixes after independent page reviews. Current main-branch documents
clarify the existing export requirement and rationale, audit checking and prompt
wording. The retained `tutorial-start` and `tutorial-complete` tags keep their
original documents and code. These are documentation changes; no app behavior,
dependency, deployment or native agent trial changed.

Next for learners: use the starter and walkthrough, compare code and context
against the requirement, and report unclear steps or assistance needed. Next for
the upstream maintainer: collect the planned unfamiliar learner feedback on the
published companion cleanup. The website-only deployment did not redeploy this
app. Documentation-only commits do not redeploy the app or replace its actual
deployed source.

See the [worked steps](walkthrough.md).

```text
Goal: runnable example and reproducible context handoff
|-- DONE    Baseline tested; starter revision retained
|-- DONE    Export implemented with requirement and decision preserved
|-- CHECKED 18 integration tests and desktop/mobile browser checks
|-- LIVE    App automatically deployed and verified; companion walkthrough published
`-- PREVIEW Main-branch teaching clarifications; retained tags unchanged
```

## Boundaries

Use synthetic/public example data only. Keep operator receipts outside the public project when they contain private
account details. No claimed agent-benefit evaluation; this is an authored
worked example. Optional event logging is off.
