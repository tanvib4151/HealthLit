# HealthLit App Store release checklist

Updated September 5, 2026 for the local-only v1.0 release.

## Release decision

**Feature freeze now.** Do not add major features before v1 ships. From this point forward, changes should be limited to release blockers, crashes, data-loss bugs, accessibility problems, misleading medical wording, and App Store submission requirements.

## Already complete in the repo

- [x] iOS bundle identifier is set: `com.healthlit.app`.
- [x] App version is `1.0.0`; iOS build number starts at `1` and production builds auto-increment.
- [x] Production EAS build profile exists.
- [x] Placeholder Apple credentials were removed from `eas.json`; EAS can prompt securely instead of reading fake values from source control.
- [x] App icon, splash configuration, export-compliance flags, and iOS privacy manifest are present.
- [x] Firebase remains intentionally unconfigured for v1, so account/sign-in UI is hidden and no HealthLit cloud backend is required.
- [x] Developer Tools are hidden in production via `__DEV__`.
- [x] Privacy policy is aligned with the local-only v1 build.
- [x] Public privacy/support pages exist under `/docs` for GitHub Pages.
- [x] Privacy Policy and Support links are accessible from Profile inside the app.
- [x] App Store metadata/reviewer notes are updated for a no-account release.
- [x] Generated report language has explicit safeguards against diagnostic, causal, predictive, and treatment-advice phrasing.
- [x] Local reminders use generic notification copy and do not require a push server.
- [x] CI release check added: clean `npm ci`, TypeScript, and Expo Doctor on every push/PR.

## BLOCKERS before App Review

### 1. Make the privacy and support URLs live

The repository contains:

- `docs/privacy.html`
- `docs/support.html`
- `docs/index.html`

In GitHub → repository **Settings → Pages**:

1. Source: **Deploy from a branch**.
2. Branch: **main**.
3. Folder: **/docs**.
4. Save.

Then verify these exact URLs in a private browser window:

- `https://tanvib4151.github.io/HealthLit/privacy.html`
- `https://tanvib4151.github.io/HealthLit/support.html`
- `https://tanvib4151.github.io/HealthLit/`

Do not submit while any of them return a 404.

Also verify that **support@healthlit.app** is a real mailbox that someone checks. If it is not, change the address in the policy, support page, and App Store materials before submission.

### 2. Run the release checks locally

After pulling the latest `main`:

```bash
npm ci
npm run release:check
```

Do not build for App Store distribution until both commands finish successfully.

The same checks also run in GitHub Actions under **Release check**.

### 3. Remove the body-map network dependency

The professional front/back body artwork is currently loaded from Wikimedia at runtime. The interaction/highlight geometry is correct, but relying on a remote asset means the figure can fail to appear offline or on a blocked network.

Before final submission, download the two verified CC0 source SVGs and vendor them into the app, for example:

- `assets/body/body-front.svg`
- `assets/body/body-back.svg`

Then update `components/body/BodyMap.tsx` to use the bundled assets rather than Wikimedia URLs.

This is a production-quality blocker because the rest of the logging flow is designed to work offline.

### 4. Production build and TestFlight

Use the actual store build, not Expo Go, for final QA.

```bash
npm install --global eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

The submitted build appears in App Store Connect/TestFlight after Apple processes it. Install that exact build through TestFlight before submitting it for App Review.

## TestFlight acceptance matrix

Every item below should pass on a physical iPhone using the production/TestFlight build.

### Launch and persistence

- [ ] Fresh install reaches onboarding without a crash.
- [ ] Medical notice is readable and can be acknowledged.
- [ ] Force-quit and reopen retains entries, profile, medications, settings, onsets, wellness check-ins, and report edits.
- [ ] Reboot the phone and confirm data remains.

### Core logging

- [ ] Log one symptom with only required fields.
- [ ] Log several symptoms in one session.
- [ ] Start/end time selector works at midnight and near day boundaries.
- [ ] Body map selects and deselects front and back regions; visible selection follows the body silhouette.
- [ ] Severity cannot be saved accidentally without a user selection.
- [ ] Add a custom symptom and log it.
- [ ] Edit and delete a saved entry.
- [ ] Backdate an entry and confirm it appears only on the correct selected day.

### History and reports

- [ ] Home date carousel changes the log shown for that date.
- [ ] View Log opens the selected day, not today's entries.
- [ ] History can reach entries older than 30 days.
- [ ] Create at least four entries and generate a Story/report.
- [ ] Evidence/details open for supported report findings.
- [ ] Custom date range includes the full final day.
- [ ] Export/share a PDF successfully.
- [ ] Printed/shared report contains no diagnostic or causal claim.

### Offline test

Turn on Airplane Mode before opening the app.

- [ ] App launches.
- [ ] Existing entries load.
- [ ] New entries save.
- [ ] History works.
- [ ] Story/report generation works.
- [ ] PDF generation works.
- [ ] Body map still renders after the SVG assets are vendored locally.
- [ ] Reminder settings do not hang or crash.

Then reconnect and confirm nothing changes or disappears.

### Failure/interruption test

- [ ] Background the app midway through logging; return and verify the draft behaves predictably.
- [ ] Force-quit during an unfinished log; reopening must not corrupt saved entries.
- [ ] Tap Save repeatedly/rapidly; no duplicate entry should be created unexpectedly.
- [ ] Rapidly move the date, severity, and time sliders to both edges; no bounce loop or stuck selector.
- [ ] Deny notification permission; reminder UI explains what happened instead of silently failing.

### Accessibility

Test with iOS **VoiceOver** enabled:

- [ ] Bottom navigation announces each tab clearly.
- [ ] Date carousel is understandable and adjustable.
- [ ] Start and end time controls announce their value and can be adjusted.
- [ ] Severity control announces its numeric value and can be adjusted.
- [ ] Body-map regions announce meaningful anatomical labels and selected state.
- [ ] Buttons, chips, switches, links, and delete actions have understandable labels.
- [ ] Privacy Policy and Support are announced as links.

Test with **Settings → Accessibility → Display & Text Size → Larger Text** at a very large setting:

- [ ] No important button text is clipped.
- [ ] No screen requires impossible horizontal scrolling.
- [ ] Logging controls remain usable.
- [ ] Report/story text remains readable.

Also check light mode, dark mode, Reduce Motion, and increased contrast if available.

## App Store Connect

Use `APP-STORE-METADATA.md` as the source of truth.

- [ ] App name and subtitle entered.
- [ ] Primary category: Medical; secondary: Health & Fitness.
- [ ] Complete Apple's current age-rating questionnaire honestly. Do not manually force a lower rating.
- [ ] Privacy Policy URL entered and verified live.
- [ ] Support URL entered and verified live.
- [ ] App Privacy answer for current local-only v1: **No data collected**.
- [ ] Description, promotional text, and keywords pasted from the metadata pack.
- [ ] Reviewer notes pasted from the metadata pack.
- [ ] App Review contact information entered directly in App Store Connect, not committed to GitHub.
- [ ] Correct TestFlight build selected.

## Screenshots

Use test/demo information only—never real private health information.

Recommended 6.9-inch portrait size: **1320 × 2868**. Apple also accepts other current 6.9-inch native sizes.

Suggested sequence:

1. Home with populated selected-day log
2. Logging with start/end selector
3. Body map with a selected region
4. Generated Story/report
5. History/trends
6. PDF/export

Before uploading:

- [ ] 1–10 screenshots supplied.
- [ ] No screenshot contains an alpha channel/transparency.
- [ ] No debug/dev controls appear.
- [ ] No real person's private health information appears.

## Medical-language release check

Before every App Store build, search changed user-facing copy for language that could imply diagnosis, causation, prediction, or treatment advice.

Avoid claims such as:

- "X caused Y"
- "This means you have..."
- "HealthLit detected..."
- "You are likely to..."
- "You should take/stop/change..."

Prefer descriptive wording tied to the user's own records, such as:

- "You recorded X on 4 occasions."
- "X and Y appeared in the same 24-hour window."
- "Severity was higher in these logged entries."

## What is intentionally NOT shipping in v1

- HealthLit account creation
- Firebase cloud backup/sync
- Advertising
- Analytics or tracking SDKs
- Remote crash reporting
- Generative AI/report generation services

Do not enable any of those without revisiting the privacy policy, App Privacy nutrition label, reviewer notes, and testing plan.

## Final go/no-go rule

Submit to App Review only when all of the following are true:

1. `npm run release:check` passes.
2. GitHub Actions **Release check** is green on the exact commit being built.
3. Privacy/support URLs are live.
4. The body illustration is bundled locally.
5. The exact TestFlight production build passes the full acceptance matrix above.
6. App Store privacy/age-rating/metadata fields match the submitted binary.

If any one of those is false, do not submit yet.
