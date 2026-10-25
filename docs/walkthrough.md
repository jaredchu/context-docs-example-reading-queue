# Worked change: JSON export

This is an authored teaching case, not an independent performance evaluation or
a transcript. The real Git snapshots are `tutorial-start` (export pending) and
`tutorial-complete` (export implemented). Both remain runnable locally.

## 1. Start from the baseline

After cloning, run `git switch -c try-export tutorial-start`, `npm ci`,
`npm run db:local` and `npm run dev`. Open the URL Wrangler prints.
Use a second terminal for checks; stop the server before switching revisions.

## 2. Inspect and reuse the setup

Install the skills separately through the [Context Docs guide](https://context-docs.com/getting-started/).
Open this project in Codex or Claude Code, then invoke `$adopt-context-docs` or
`/adopt-context-docs`, respectively. The example already has context and a
maintenance rule, so reuse those instead of inventing a second layout. Inspect
AGENTS.md and CLAUDE.md. Confirm which instructions your client actually loads;
a marker is evidence of configuration, not proof of implicit loading. Logging
stays off. Read the [entry point](project-context.md) and relevant source links.

## 3. Audit without editing

Ask: "Use context-docs to audit project context against the linked decisions,
requirement, source and tests. Report concrete gaps; leave files unchanged."
Compare `git status --short` before and after. A later maintenance request can
authorize repairs; an audit cannot.

## 4. Save the requirement and handoff

The [export requirement](export-requirement.md) is canonical. The
[decision note](decisions.md) explains why export covers the whole queue, even
when a UI filter hides read links. Ask the agent to preserve that decision,
record the pending task and next action in current context, and keep its progress
view current without implementing export yet. Review the diff and authority:
the implementation team chose this exercise; it is not a quoted owner decision.
Only record checks you actually ran.

## 5. Resume in a new session

Open a fresh session in the same folder and ask:

> Read AGENTS.md, README.md and docs/project-context.md, then sources relevant to
> the next action. Separate verified facts from pending work. Implement the JSON
> export requirement, preserve isolation and expiry, run appropriate tests and
> maintain current context from observed results. Do not deploy.

An explicit read helps make the handoff inspectable; it does not prove every
client automatically loads instructions. The agent still needs to inspect code.
When sessions share a context file, agree on one writer.

## 6. Verify the implementation and context

Run `npm test`, `npx wrangler deploy --dry-run --outdir .local/build` and
`git diff --check`. Inspect the diff. In a browser, add two public links, mark
one read, select Unread and export: both active items should be in the file.
Use another browser context for isolation. Check an empty export and simulate a
failed export request: show an error and do not download. Confirm exported data
contains no cookie/session/database metadata. These are application checks, not
Context Docs agent evaluations.

Review the updated project context: preserve the decision, state the actual
validation and remaining limits, and name the next action. Do not paste a chat
transcript or raw account/deployment output into shared context.

## 7. Compare and optionally deploy

Inspect the reference solution with:

```sh
git diff tutorial-start..tutorial-complete -- src public tests docs
```

Compare behavior and retained knowledge rather than exact model wording. To
deploy your own copy, follow [the README](../README.md#deploy-your-own-copy).
Use your own fork, Worker name, database and dedicated CI secret. Deployment is
separate from this local exercise. Documentation-only commits do not require
another deployment. Git records history; a journal is not necessary here.

Context Docs supplies reusable maintenance guidance. A well-maintained README
and native agent instructions may be sufficient for smaller workflows. This
example makes no claim of measured savings, general reliability or privacy.
