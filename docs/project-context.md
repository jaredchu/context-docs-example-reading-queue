# Reading Queue switching exercise

## Goal
Add JSON export while preserving browser isolation, expiry and existing CRUD.
The baseline queue works; export API and browser integration are pending.
Read the [export requirement](export-requirement.md) and
[decision](decisions.md#export-exercise) before changing code.

## Exercise scope
This authored exercise reuses Reading Queue's tutorial starter. Complete the
API first, save context, stop that writer, then open the other client and finish
the browser integration. No deployment, publication, database migration, schema
change, new dependency or URL fetching is part of this exercise. Historical
publication directions in other tutorial records do not apply to this task.

## Current state and verification
Export is unimplemented in both src/worker.js and public/.
The baseline includes API tests; this starter snapshot records no newly run tests.
Run the checks in your environment and record their actual results.

## Next action
Implement and test GET /api/export, leaving the browser button for the next
agent. Preserve the whole-queue backup rationale and precise verification limits.

## Maintenance
Keep this entry point and the linked decisions current. Logging stays off.
