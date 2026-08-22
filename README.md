# HealthLit

A symptom diary for people managing chronic conditions — built so that logging takes seconds, even on a bad day.

Chronic illness appointments are short, and months of symptoms are almost impossible to summarise from memory. HealthLit records what you're experiencing in a few taps, then turns those entries into a structured summary you can print or hand to a clinician.

**Core principle: someone in pain should be able to use this app in under three seconds.**

---

## What makes it different

**Reports are calculated, not generated.** There is no language model anywhere in the report pipeline. Every sentence is produced by deterministic arithmetic over the user's own entries, on the device. It works offline, costs nothing to run, and — most importantly — cannot invent anything.

**Every figure is traceable.** Tap any sentence in a report to see the exact entries it was computed from. Sentences are typed `derived`, `reference`, or `user`, and the test suite fails the build if a derived sentence states a number without citing its evidence.

**It stays quiet when the data is thin.** Most symptom trackers will confidently tell you that rest helps your headaches. That claim is usually an artefact of *indication bias* — people record rest because severity is high, so a naive comparison makes every remedy look useless or harmful. HealthLit compares **paired readings within an episode**, stratified per symptom, and drops any finding that doesn't survive 200 seeded resamples. It reports fewer things, and the things it reports are defensible.

**It never diagnoses.** No causes, no conditions, no predictions, no advice. That constraint is enforced mechanically by a language linter (`utils/storyLanguage.ts`) that fails the build on causal or diagnostic phrasing, rather than relying on whoever writes the next sentence to remember.

---

## Features

- **Per-symptom logging** — log several symptoms in one session, each with its own severity, duration, triggers, relief factors, body regions and notes. Each card commits independently, so an interrupted session keeps whatever was saved.
- **Symptoms-to-Story** — a nine-section summary covering why you're seeking care, when it started, how it's changed, what you're experiencing, frequency and duration, patterns, what helps, what occurs alongside, and what you've tried. Any date range, every section editable, printable to PDF.
- **Evidence sheet** — tap any sentence to see the readings behind it.
- **Trends and history** — severity over time, symptom frequency, full searchable history.
- **Body map** — mark where it hurts, with a text fallback for accessibility.
- **Medications** — linkable to individual readings, so the engine can compare recovery with and without them.
- **Symptom onset dates** — because "first logged in this app" is not the same as "when it started".
- **Daily reminders** — local only, no server, and no health data in the notification text.
- **Optional cloud backup** — Firebase, entirely opt-in. Every feature works without an account.
- **Light and dark mode**, with symptom accent colours held constant across both for recognition.

---

## Tech stack

React Native · Expo · TypeScript (strict) · Expo Router · Zustand · AsyncStorage · Firebase (optional) · react-native-svg

```
app/            file-based routes (thin re-exports)
screens/        screen implementations
components/     reusable UI, body map, onboarding, settings
store/          Zustand stores
services/       persistence + platform boundaries (the migration seam)
utils/          pure logic — the entire story pipeline lives here
tools/          golden tests and the demo probe (not shipped in the app)
types/          data models
```

**Architectural rules this codebase actually follows:**

- Relative imports only. `@/` path aliases fail at Metro runtime here.
- All persistence goes through `services/`. Stores never touch AsyncStorage directly, which is what makes Firebase a drop-in rather than a rewrite.
- `useTheme()` on every component; static `StyleSheet.create` can't react to mode changes.
- Local-first, always. No feature is ever gated behind sign-in.
- Health data is never logged to the console.

---

## Getting started

```bash
npm install --legacy-peer-deps   # Expo SDK peer conflicts require this
npx expo start
```

Press `w` for web, or scan the QR code with Expo Go.

To see the app with realistic data: **Profile → Developer Tools → Load Demo Data**, then **Home → Your Story → Generate story**.

### Tests

```bash
npx tsx tools/storyGolden.ts            # golden tests
npx tsx tools/storyGolden.ts --update   # bless intentional changes
npx tsx tools/demoProbe.ts              # what the demo data produces
```

No test runner and no dev dependencies — deliberately, so tests run on any machine without setup.

The golden suite runs five synthetic patients, two of which are adversarial:

- **`severityOnly`** logs only at peak severity. Severity always falls afterwards regardless of what was recorded. The build **fails** if the engine credits any remedy for that — it would be reporting regression to the mean as an effect.
- **`constant`** is 90 entries of uniform noise. The build **fails** if any pattern is claimed.

Every run also checks that no generated sentence uses causal or diagnostic language, and that every derived figure cites entries that exist.

---

## Configuration

Cloud sync is optional and **off by default**. `services/firebaseConfig.ts` ships with placeholder values, and the app detects this: sign-in is hidden, sync calls become no-ops, and everything else works normally.

To enable it, replace `FIREBASE_CONFIG` with your project's values and deploy `firestore.rules` — those rules are the actual security boundary, since client config values are not secret.

---

## Status

Pre-release, preparing for App Store submission. See `APP-STORE-CHECKLIST.md`.

**Known gaps:** caretaker mode isn't built; `DailyLog` in `types/models.ts` is unused; `Intl` date formatting needs checking on a physical Android device before shipping that platform.

---

## Disclaimer

HealthLit is a symptom diary, not a medical device. It does not diagnose conditions, identify causes, predict outcomes, or recommend treatment. Always speak to a qualified clinician about your health.

## Licence

Copyright © 2026. All rights reserved.
