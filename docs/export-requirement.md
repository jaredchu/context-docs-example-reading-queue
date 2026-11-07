# JSON export change

Status: pending at `switching-start`, based on `tutorial-start`. This teaching requirement was chosen by the
implementation team; it is not a verbatim owner request or historical transcript.

## Acceptance criteria

- A visible Export JSON button downloads `reading-queue.json`.
- Export includes all active items in the current browser's queue, including read
  items hidden by a filter. It excludes expired items and other browser sessions.
- The JSON has `schema_version: 1` and `items`, each with `title`, `url` and boolean
  `read`. Exclude session cookies, database IDs and account identifiers.
- An empty queue exports `{"schema_version":1,"items":[]}`. Export does not mutate stored data.
- Fetch fresh data from the API when exporting; surface a failed request and do
  not download a file in that case.
- Preserve existing CRUD, isolation, expiry and cap behavior. No schema change,
  new runtime dependency or cloud service is needed.

## Evidence to collect

Run the API tests, add meaningful export coverage (filter independence, empty
queue, session isolation, no writes), then check the actual browser download
and an error case. Update current context only from observed results.

## Switching exercise split

The outgoing agent implements only the API and meaningful API tests. It records
completed work, actual checks and pending browser work in project context. The
receiving agent reads those files and completes the browser button, fresh export
fetch, download and visible error behavior. The versioned empty shape above is
an explicit teaching clarification; it is not a quotation of a historical owner.
