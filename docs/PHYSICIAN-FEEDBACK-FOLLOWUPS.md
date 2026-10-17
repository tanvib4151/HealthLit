# Physician feedback — follow-up work

## Current storage and migration direction
- Symptom records currently persist in AsyncStorage under `healthlit.symptom_entries.v1` through `services/entryStorage.ts`.
- Optional Firebase synchronization exists in the repository; do not add or replace a cloud provider in this change.
- Future migration should preserve stable record IDs and original occurrence fields, use an explicit schema version and a reversible local backup, and test restoring pre-migration entries.
- Define opt-in authentication and user ownership before enabling sync.
- Support offline writes with a durable local queue, idempotent upload, retry, and a clearly documented conflict policy for concurrent edits/deletes.
- Avoid overwriting newer records silently; distinguish deleted records from missing sync results.
- Verify data export, account deletion, privacy, and recovery behavior before rollout.

## Physician interview checklist (questions, not answers)
1. What symptom information is hardest for patients to communicate?
2. What missing details most often require follow-up questions?
3. How should intermittent symptoms be represented?
4. What makes a pre-visit summary useful?
5. Which details should remain optional to keep logging manageable?

## Validation not yet performed
- Automated tests and TypeScript check
- WCAG 2.2 AA targeted manual review and native accessibility checks
- iPhone 15 Pro HealthLit heading rendering, small-screen and enlarged-text checks
- Light/dark theme checks
- Historical record preservation and CSV round-trip tests
