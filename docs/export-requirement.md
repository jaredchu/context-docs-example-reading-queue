# JSON export change

Status: implemented in the completed revision; pending at `tutorial-start`. This teaching requirement was chosen by the
implementation team; it is not a verbatim owner request or historical transcript.

## Acceptance criteria

- A visible Export JSON button downloads `reading-queue.json`.
- Export includes all active items in the current browser's queue, including read
  items hidden by a filter. It excludes expired items and other browser sessions.
- The JSON has `schema_version: 1` and `items`, each with `title`, `url` and boolean
  `read`. Exclude session cookies, database IDs and account identifiers.
- An empty queue exports an empty array. Export does not mutate stored data.
- Fetch fresh data from the API when exporting; surface a failed request and do
  not download a file in that case.
- Preserve existing CRUD, isolation, expiry and cap behavior. No schema change,
  new runtime dependency or cloud service is needed.

## Evidence to collect

Run the API tests, add meaningful export coverage (filter independence, empty
queue, session isolation, no writes), then check the actual browser download
and an error case. Update current context only from observed results.

## Completed checks

The 18-test application suite passed locally on October 25, 2026. Export coverage
checks both read states, another browser, a physically stored expired row, an
empty queue and unchanged database rows. Headless Chrome checked the actual
download under Unread filtering, a fresh server-side addition, empty export and
a failed request producing no file. These checks are not an agent evaluation.
