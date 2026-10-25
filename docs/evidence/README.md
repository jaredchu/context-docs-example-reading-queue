# Ordinary-prompt continuation check

On October 25, 2026, the maintainer ran one fresh Claude Code continuation at
Opus 5.5 / High from starter commit `2f12614`, before the final
`tutorial-start` tag at `238d1d3`. The final tag adds the license and revised
walkthrough prompts; application code is unchanged between those commits. The
[exact prompt and result](ordinary-prompt-2026-10-25.json) show that the user
request names no skill and asks for no documentation update. With the project
maintenance instructions and installed core 0.2.6 available, the tool trace
records a `context-docs` invocation and edits to three context documents.
The [actual Markdown diff](ordinary-prompt-context.diff) preserves implemented
export, API checks and pending browser verification.

## Retained wording qualification

The observed decision diff says IDs, timestamps and the session "never leave
the Worker." That phrase is overbroad: the normal list API returns IDs and
timestamps, and the session cookie is sent to the browser. Only the new export
response excludes those fields. The actual diff is preserved, with this
correction beside it. Context maintenance occurred; this wording still needs
review. It is not an error-free-context result.

The coordinator independently reran the fixture's 20 API tests successfully.
No browser ran in this native case; its implementation was not substituted for
the separately integrated published app. That app has 18 tests and separate
browser/deployment evidence. This check establishes one observed ordinary-prompt
maintenance outcome, not reliable implicit selection, Codex behavior, improved
handoffs or savings. Other prompts in the walkthrough are authored guidance.

The local CLI allowed native skills and repository instruction loading, disabled
hooks, auto-memory and MCP, and allowed only `npm test` shell work. Two earlier
configuration-limited attempts also updated project documents, but the installed
skill was not available there; they are not evidence of packaged skill use.
Their provenance and the complete private traces are retained in operator notes.
