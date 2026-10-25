# Reading Queue

A runnable [Context Docs](https://context-docs.com/) worked example using
Cloudflare Workers, static assets and D1. Save public links, mark them read and
filter your queue. Each browser gets a temporary, isolated sandbox.

The app is deliberately small: no framework, link fetching, login or object
storage. The example demonstrates source-linked context, implementation decisions,
a scoped change, review and a fresh-session handoff. It is authored teaching
material, not an independent evaluation of agent performance.

## Run locally

Install Node.js 22 or later (Node 24 is used in CI), npm and Git. No Cloudflare
account is needed for local development. From a fresh clone:

```sh
git clone https://github.com/jaredchu/context-docs-example-reading-queue.git
cd context-docs-example-reading-queue
npm ci
npm run db:local
npm run dev
```

Open the localhost URL printed by Wrangler. Local D1 data is in the ignored
`.wrangler/` directory; remote data is separate. Run `npm test` for the Worker/API
checks against workerd and an isolated local D1 database.

## Follow the Context Docs example

Start with [project context](docs/project-context.md), then follow the
[worked change](docs/walkthrough.md). `tutorial-start` is the baseline queue,
with the export requirement still pending. `tutorial-complete` contains the
completed JSON export. These are real Git snapshots of this example; they are
not recordings of an independent agent experiment.

[The ordinary-prompt check](docs/evidence/README.md) retains one observed
maintenance outcome and its limits; the other tutorial prompts are authored
guidance. [Decisions](docs/decisions.md) explain the design. [Export requirements](docs/export-requirement.md)
own the exercise's acceptance criteria. AGENTS.md contains the maintenance rule;
CLAUDE.md imports it. Install the Context Docs skills separately using the
[installation guide](https://context-docs.com/getting-started/). This repository
does not install skills or change your agent settings.

## Deploy your own copy

1. Fork this repository and clone your fork. Change `name` in `wrangler.jsonc`
   to a unique Worker name before deploying. Set `database_name` to the name you
   create below and keep the `DB` binding. The .jsonc file intentionally uses
   strict JSON: the deploy script does not support comments.
2. Run `npm ci`, `npx wrangler login`, then `npx wrangler whoami`. Select your
   intended Cloudflare account with `CLOUDFLARE_ACCOUNT_ID` if you have several.
3. Create a database with `npx wrangler d1 create YOUR_DATABASE_NAME`. Save its
   UUID as `CLOUDFLARE_D1_DATABASE_ID` in your shell. This command creates a
   remote resource; local development does not need it.
4. Commit your configuration changes, then run `npm run deploy`. The script
   writes an ignored `.wrangler.deploy.json`, applies remote migrations and
   deploys the Worker. It injects the current Git commit into `/api/health`.
5. Use the workers.dev URL printed by Wrangler. Add it as the `DEMO_URL`
   repository variable for CI verification. Custom domains are optional.

The [deployment script](scripts/deploy.mjs) requires a real database UUID and
a Git commit. The checked-in placeholder works for local development only.
Do not put a token in the configuration file, source, README or shell history.

## Automatic deployment from GitHub

The [workflow](.github/workflows/ci.yml) tests pull requests without deployment
credentials. For pushes to main it tests, applies D1 migrations, deploys, and
verifies the live health endpoint reports that commit. Documentation-only pushes
are excluded to avoid unnecessary deployments. Unconfigured forks skip the
deployment job until the database variable is set. A manual run on main is also
available. GitHub Actions must be enabled in your fork.

Create a GitHub Environment named `production` in Settings → Environments,
and restrict its deployment branches to `main` only. Put the deployment secret
there; the workflow uses that environment. Set repository variables in
Settings → Secrets and variables → Actions:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Your intended Cloudflare account |
| Variable | `CLOUDFLARE_D1_DATABASE_ID` | Your D1 database UUID |
| Variable | `DEMO_URL` | Your HTTPS workers.dev URL |
| Environment secret (`production`) | `CLOUDFLARE_API_TOKEN` | A dedicated deployment API token |

Use a dedicated token with Workers Scripts Write and D1 Write for the selected
account, or narrower equivalent permissions supported by your account. These
legacy permissions are account-scoped; do not treat a repository secret as
resource-level Cloudflare isolation. Rotate the token before its expiry. Never
copy a local OAuth token into GitHub. The demo's credential is configured
separately and is not included in this repository.

With the `production` environment restricted to `main`, only main-branch
deployment jobs can receive the token. Review workflow
and dependency changes before merging. There are no automatic PR deployments
or remote database tests. Migrations run before code: keep them compatible with
the currently deployed Worker; a code rollback does not reverse a schema change.

Cloudflare account quotas and billing still apply. The sandbox caps stored rows,
not incoming traffic or total resource usage. No paid plan or R2 bucket is needed
for this example. Consult current [Workers GitHub Actions guidance](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
and [D1 migration guidance](https://developers.cloudflare.com/d1/reference/migrations/)
before adapting deployment.

## Demo limits

Use only public example URLs. Queues are browser-specific, use a random HttpOnly
cookie and expire within 24 hours; they are not account-authenticated private
storage. The server permits 20 links per queue and 2,000 stored links globally,
and removes expired rows on writes and a daily schedule. Cookie loss loses
access to the queue. There is no sync, recovery, import or production abuse
protection. To retain something, use your own durable tool.

## License and attribution

MIT. Human-authored repository ownership is preserved. Codex and Claude Opus 5.5
assisted implementation and review; individual commits record actual assistance.
