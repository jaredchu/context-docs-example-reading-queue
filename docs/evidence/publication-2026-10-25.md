# Reading Queue publication evidence — October 25, 2026

Historical publication checks and collaboration notes extracted from the
[project context at 3535e5c](https://github.com/jaredchu/context-docs-example-reading-queue/blob/3535e5cb6e41c82eb1a40c08360cae22d6602d47/docs/project-context.md)
on October 26 to keep the current entry point useful to learners. Relative links
are updated for this folder. These observations retain their October 25 scope;
no deployment, live check or agent evaluation was rerun for this extraction.
The original source remains unchanged in Git.

## Retained publication observations

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
focused follow-up found no material issues. The [normal-prompt evidence](README.md)
records a separate observed maintenance outcome and its wording qualification.
The [companion walkthrough](https://context-docs.com/reading-queue/) is now live
from the verified `b38853d` Context Docs website build. Next action for the
upstream maintainer: gather concrete learner feedback. Documentation-only commits do not redeploy
the app or replace the actual deployed source SHA.

## Reading this record

The next action above describes the state at publication. Current work and
preview status belong in [project context](../project-context.md). The
[ordinary-prompt case](README.md) remains a separate implementation and evidence
record, with its original wording qualification. Later documentation-only
commits do not change the deployed app revision.
