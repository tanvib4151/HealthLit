# Deferred cloud storage and physician research

## Current storage architecture

HealthLit remains a local-first Expo SDK 54 / React Native app. Zustand holds drafts and hydrated records. Services write versioned JSON through AsyncStorage: symptom entries (`healthlit.symptom_entries.v1`), medications, custom symptoms, profile, symptom onsets, story overrides, wellness check-ins, and device preferences. This is not an encrypted database; encryption at rest has not been added. Device preferences are not health records and are not synced.

The repository already includes optional Firebase Authentication and Firestore synchronization. When configured and signed in, existing store actions push records to collections under `users/{uid}`; the orchestrator pulls and merges by stable ID and `updatedAt`. The UI hides account controls without configured Firebase credentials. This change does not introduce a cloud provider, enable Firebase, or deploy rules. Existing best-effort sync has no durable offline upload queue or multi-device conflict UI.

New observation fields are optional; schemaVersion and the existing storage key remain 1. Old records are not mass-rewritten. Missing continuity and precision stay unknown; legacy duration values are retained. Reading no longer rewrites storage. Unrecognized array records are carried through writes, and unreadable JSON is not overwritten. Local saves are acknowledged only after the storage write succeeds. Individual deletions remove patient details and keep only the ID, deletion timestamp and empty required compatibility fields as tombstones through the existing persistence/sync path; active history and exports omit deleted entries. This prevents an older remote copy from restoring a deleted entry in this version. Older app versions do not understand tombstones.

## Deferred cloud migration plan

1. Inventory every collection, owner, storage key, schema, device version, and retention requirement. Decide whether the existing Firebase implementation meets the requirements before considering any replacement.
2. Obtain explicit opt-in and explain ownership, retention, backups, encryption, export and account deletion. Do not upload existing local history automatically as part of a migration.
3. Before migrating, create a versioned, verified, reversible local backup. Preserve IDs, original timestamps, occurrence calendar dates, timezone/precision, unknown fields, and deletion tombstones. Verify counts and round-trip restoration, including pre-feedback records.
4. Add a durable offline operation queue with idempotent writes, bounded retries and visible sync status. Define edit/edit, edit/delete, clock-skew and account-switch conflict behavior. Do not infer deletion from an absent query result or silently overwrite newer records.
5. Design and emulator-test owner isolation, optional-field validation, deletion semantics and batch limits. Coordinate minimum supported app versions before deploying tombstone-aware rules. The compatibility rules in this branch are source only; they have not been deployed.
6. Test interrupted migration, offline/reconnect, multiple devices, sign-out, account deletion, recovery and export. Verify local data stays available on failure. Roll out behind opt-in and a reversible flag; retain the validated backup until successful restoration has been demonstrated.

No cloud-migration implementation or production infrastructure change is included.

## Deferred physician research — five-question interview checklist

Questions only; no physician responses have been supplied or invented.

1. What symptom information is hardest for your patients to communicate accurately?
2. Which missing details most often require follow-up questions during a visit?
3. How should we distinguish continuous symptoms, repeated episodes, the observation window, and time actually spent with symptoms in a summary?
4. What makes a pre-visit summary useful, and what information or presentation would make it misleading?
5. Which fields should remain optional to keep logging manageable, especially for older adults and people with intermittent symptoms?

Record each interview's date, clinician's consent and specialty, verbatim feedback, unresolved questions, and proposed changes separately. Validate those changes with patients before adopting them.
