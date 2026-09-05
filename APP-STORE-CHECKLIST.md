# HealthLit App Store release checklist

Updated September 5, 2026 for the local-only v1.0 release.

## Release decision

**Feature freeze now.** Before v1 ships, limit changes to release blockers, crashes, data-loss bugs, accessibility problems, misleading medical wording, and App Store submission requirements.

## Complete in the repo

- [x] iOS bundle identifier: `com.healthlit.app`.
- [x] App version: `1.0.0`; iOS build number starts at `1`; production builds auto-increment.
- [x] Production EAS profile exists and fake App Store credential placeholders were removed.
- [x] App icon, splash configuration, export-compliance flags, and iOS privacy manifest are present.
- [x] Firebase is intentionally unconfigured for v1, so account/sign-in UI is hidden and the release does not depend on a HealthLit backend.
- [x] Developer Tools are hidden in production via `__DEV__`.
- [x] Privacy policy describes the actual local-only v1 build.
- [x] Public privacy/support pages exist under `/docs` for GitHub Pages.
- [x] Privacy Policy and Support links are available from Profile inside the app.
- [x] A production **Erase all data on this device** control is available in Profile with two-step confirmation.
- [x] App Store metadata/reviewer notes are written for the no-account release.
- [x] Report-language safeguards block diagnostic, causal, predictive, and treatment-advice phrasing.
- [x] Local reminders use generic notification text and do not require a push server.
- [x] The professional CC0 front/back body artwork is vendored in `assets/body` as source SVGs and bundled PNGs.
- [x] `BodyMap` uses the bundled transparent PNGs for both the visible figure and alpha mask; it no longer needs Wikimedia at runtime.
- [x] Body artwork source/license provenance is documented in `assets/body/README.md`.
- [x] CI runs a clean install, TypeScript, Expo Doctor, and a report-only production dependency audit on every push/PR.
- [x] Previously existing TypeScript errors in Auth and sync code were fixed.

## Remaining blockers that require your accounts or physical device

### 1. Make Privacy and Support live

The repository contains:

- `docs/index.html`
- `docs/privacy.html`
- `docs/support.html`

In GitHub → repository **Settings → Pages**:

1. Choose **Deploy from a branch**.
2. Branch: **main**.
3. Folder: **/docs**.
4. Save.

Then open these exact URLs in a private browser window:

- `https://tanvib4151.github.io/HealthLit/`
- `https://tanvib4151.github.io/HealthLit/privacy.html`
- `https://tanvib4151.github.io/HealthLit/support.html`

Do not submit while any return 404.

Also verify that **support@healthlit.app** is a real mailbox you can receive mail at. If it is not, change that address in the policy, support page, and App Store materials before submission.

### 2. Pull and run the release check locally

```bash
git pull --ff-only origin main
npm ci
npm run release:check
```

GitHub Actions runs the same TypeScript/Expo checks automatically. Build only from a commit where **Release check** is green.

### 3. Build the production app and install through TestFlight

Do not use Expo Go as the final release test.

```bash
npm install --global eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

After Apple processes the upload, install that exact build through TestFlight and complete the acceptance matrix below before submitting for App Review.

## TestFlight acceptance matrix

### Launch and persistence

- [ ] Fresh install reaches onboarding without a crash.
- [ ] Medical notice is readable and can be acknowledged.
- [ ] Force-quit/reopen retains entries, profile, medications, settings, onsets, wellness check-ins, and report edits.
- [ ] Reboot the phone and confirm saved data remains.

### Core logging

- [ ] Log one symptom with only required fields.
- [ ] Log several symptoms in one session.
- [ ] Start/end time selector works at midnight and near day boundaries.
- [ ] Body map selects/deselects front and back regions and the visible highlight follows the silhouette.
- [ ] Body map still renders in Airplane Mode.
- [ ] Severity cannot be saved without an intentional user selection.
- [ ] Add and log a custom symptom.
- [ ] Edit and delete a saved entry.
- [ ] Backdate an entry and confirm it appears only on the correct day.

### History and reports

- [ ] Home date carousel changes the log displayed for that date.
- [ ] View Log opens the selected day rather than today's entries.
- [ ] History can reach entries older than 30 days.
- [ ] Create at least four entries and generate a Story/report.
- [ ] Evidence/details open for supported report findings.
- [ ] A custom date range includes the full final day.
- [ ] Export/share a PDF successfully.
- [ ] Review exported wording for accidental diagnosis, causation, prediction, or treatment advice.

### Offline

Turn on Airplane Mode before opening the app.

- [ ] App launches.
- [ ] Existing entries load.
- [ ] New entries save.
- [ ] History works.
- [ ] Story/report generation works.
- [ ] PDF generation works.
- [ ] Front/back body map renders and remains selectable.
- [ ] Reminder settings do not hang or crash.

Reconnect and confirm nothing changes or disappears.

### Failure/interruption

- [ ] Background midway through logging and return; draft behavior is predictable.
- [ ] Force-quit during an unfinished log; saved entries are not corrupted.
- [ ] Tap Save rapidly; no accidental duplicate entries.
- [ ] Rapidly move date, severity, and time sliders to both edges; no bounce loop or stuck selector.
- [ ] Deny notification permission; reminder UI explains what happened.
- [ ] Use **Erase all data on this device**, cancel after the first tap, then test the full two-tap erase with disposable test data.
- [ ] After erase, entries/profile/medications/custom symptoms/onsets/wellness/report edits are gone and the app remains usable.

### Accessibility

Test with iOS **VoiceOver** enabled:

- [ ] Bottom navigation announces each tab clearly.
- [ ] Date carousel is understandable and adjustable.
- [ ] Start/end time controls announce their values and can be adjusted.
- [ ] Severity announces its numeric value and can be adjusted.
- [ ] Body-map regions are usable and their selected state is understandable.
- [ ] Buttons, chips, switches, links, and delete/erase actions have understandable labels.
- [ ] Privacy Policy and Support are announced as links.

Test with **Larger Text** at a very large setting:

- [ ] No important button text is clipped.
- [ ] No screen becomes impossible to navigate.
- [ ] Logging controls remain usable.
- [ ] Report/story text remains readable.

Also check light mode, dark mode, Reduce Motion, and increased contrast if available.

## App Store Connect

Use `APP-STORE-METADATA.md` as the source of truth.

- [ ] Name and subtitle entered.
- [ ] Primary category: Medical; secondary: Health & Fitness.
- [ ] Complete Apple's current age-rating questionnaire honestly; use the rating Apple generates.
- [ ] Privacy Policy URL entered and verified live.
- [ ] Support URL entered and verified live.
- [ ] Current local-only v1 App Privacy answer: **No data collected**.
- [ ] Description, promotional text, and keywords pasted from the metadata pack.
- [ ] Reviewer notes pasted from the metadata pack.
- [ ] App Review contact information entered directly in App Store Connect.
- [ ] Correct production/TestFlight build selected.

## Screenshots

Use demo/test information only—never real private health information.

Recommended 6.9-inch portrait size: **1320 × 2868**. Apple also accepts other current 6.9-inch native sizes.

Suggested sequence:

1. Home with populated selected-day log
2. Logging with start/end selector
3. Body map with selected region
4. Generated Story/report
5. History/trends
6. PDF/export

Before upload:

- [ ] 1–10 screenshots supplied.
- [ ] No alpha/transparency.
- [ ] No debug/developer controls visible.
- [ ] No real private health information.

## Medical-language release check

Search any changed user-facing copy for language that could imply diagnosis, causation, prediction, or treatment advice.

Avoid:

- “X caused Y”
- “This means you have…”
- “HealthLit detected…”
- “You are likely to…”
- “You should take/stop/change…”

Prefer descriptive wording tied to the person's own records, for example:

- “You recorded X on 4 occasions.”
- “X and Y appeared in the same 24-hour window.”
- “Severity was higher in these logged entries.”

## Intentionally not shipping in v1

- HealthLit account creation
- Firebase cloud backup/sync
- Advertising
- Analytics or tracking SDKs
- Remote crash reporting
- Generative-AI report generation

Do not enable any of these without revisiting the privacy policy, App Privacy answers, reviewer notes, and testing plan.

## Final go/no-go rule

Submit to App Review only when all are true:

1. `npm run release:check` passes.
2. GitHub Actions **Release check** is green on the exact commit being built.
3. Privacy/support URLs are live and the support mailbox works.
4. The exact TestFlight production build passes the full acceptance matrix.
5. App Store privacy, age-rating, metadata, and screenshots match the submitted binary.
