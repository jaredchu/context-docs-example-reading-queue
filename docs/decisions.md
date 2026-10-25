# Implementation decisions

## Small Cloudflare stack

Status: selected by the implementation team, October 25, 2026.
The owner requested a separate runnable GitHub project, automatic deployment and
a Cloudflare demo. Reading Queue, Workers static assets and D1 are our
implementation choices. R2 would add no useful behavior for URL records, so it
is omitted. Context Docs itself does not require any cloud service.

Sources: [configuration](../wrangler.jsonc), [schema](../migrations/0001_create_items.sql),
[Worker](../src/worker.js).

## Disposable browser sandboxes

Status: selected for the public teaching demo, October 25, 2026.
Every visitor should be able to try the app without modifying another visitor's
queue. A random HttpOnly cookie identifies a temporary queue. Links become inaccessible after 24 hours; expired rows are removed on writes
and daily cleanup. Server-side caps bound stored rows. No user account, URL
fetching, cross-device synchronization or private-data guarantee is provided.
These bounds do not prevent traffic from consuming quotas.

Sources: [Worker](../src/worker.js), [API tests](../tests/worker.test.js),
[visible demo copy](../public/index.html).

## Export exercise

Status: implemented; pending in the retained starter revision.
Add JSON export as a small second change. It creates a clear handoff without a
schema migration or extra service. Export always contains the visitor's entire
active queue, regardless of the UI filter, and excludes session identifiers.
The [requirement](export-requirement.md) owns acceptance criteria.

## Optional history

Status: off. Git commits, decision notes and test/deployment output are enough
for this example. Do not enable an event journal merely to demonstrate a feature.
