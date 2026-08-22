# Pre-build audit — standalone vs Expo Go

Static audit for things that work in Expo Go and fail in a production build. Six classes checked; four issues found, three fixed, one flagged.

---

## FIXED — Firebase initialised on placeholder credentials

**Severity: high (launch-path crash risk)**

`services/firebaseConfig.ts` called `initializeApp(FIREBASE_CONFIG)` at **module scope** with `apiKey: 'YOUR_API_KEY'`, and `app/_layout.tsx` attaches an auth listener at launch. Every build shipped so far would have initialised a Firebase app pointed at a project that does not exist, then subscribed to it.

Rather than telling you to rip Firebase out by hand, I made it degrade:

```ts
export const isFirebaseConfigured: boolean =
  !FIREBASE_CONFIG.apiKey.startsWith('YOUR_') && ...
```

When unconfigured: `firebaseApp`, `auth` and `db` are `null`; `initAuthListener` immediately reports the auth check complete instead of hanging; every sync function short-circuits at the existing `currentUid()` gate; and Profile's "Back up & Sync" card is hidden.

**Shipping v1 without accounts is now a configuration state, not a code change.** Paste real credentials in and everything switches back on. This also removes the Guideline 2.1 risk of a reviewer finding a sign-in that cannot succeed.

## FIXED — `expo-glass-effect` removed

**Severity: high (build failure)**

The tab bar imported `expo-glass-effect` for the sliding indicator. That's a native module requiring a recent Xcode/iOS SDK on the EAS build image, and its version line (57.x) doesn't match the `expo ~54.0.0` your `package.json` pins. That is a failed build, twenty minutes at a time, for an effect only visible on the newest iOS.

The solid-pill fallback already existed and was already the path most devices took — it's now the only path. The removal and how to reverse it are documented in `app/(tabs)/_layout.tsx`.

**One less native dependency is the single best thing you can do to a first build.**

## FIXED — fonts not gating first render

**Severity: medium (visible reflow)**

`useFonts({...})` was called with its return value discarded. Expo Go tolerates this; a standalone build renders as soon as it's ready, and every style in `utils/theme.ts` names an Inter family directly — so text could paint in the system font and visibly reflow.

Now `const [fontsLoaded, fontError] = useFonts(...)` and the splash holds until fonts settle. A font *error* also counts as settled, so a corrupt asset starts the app in the system font rather than parking it on a splash screen forever.

## FLAGGED — `Intl` on Android

**Severity: low for iOS, real for Android**

12 calls to `toLocaleDateString` / `toLocaleTimeString` with options like `{ month: 'short' }`, across `storyTimeline.ts`, `entryStats.ts`, `reportService.ts` and three screens.

iOS uses system ICU and is fine. Hermes on Android has historically shipped without full ICU, where these can silently return a different format — dates in your clinical report reading `8/13/2026` instead of `Aug 13, 2026`. Not fixing it now since you're iOS-first, but **check the report and timeline on a physical Android device before you ship Android.**

## CLEAN

- **No `process.env` / `__DEV__` usage** — no dev-only code paths that behave differently in release.
- **No stray `require()`** outside the one deliberate, documented case in `firebaseConfig.ts`.
- **No browser storage APIs.**
- **Config plugins** — `expo-router` and `expo-splash-screen` are declared; nothing else in the dependency list needs one now that glass is gone.
- **Firestore rules** — `users/{userId}/{document=**}` already covers the two new collections, so no rules change was needed for sync.

---

## Error boundaries (item 1)

Two layers:

- **`app/_layout.tsx`** wraps the whole navigation tree. A render crash anywhere shows a readable message instead of unmounting to a white screen — which in a standalone build is unrecoverable without a force-quit, and sometimes not even then if the crash is in rehydrated data.
- **`app/story.tsx`** gets its own boundary. It runs the entire story pipeline over user data, so it's both the most computation-heavy screen and the one most exposed to unusual data shapes. Its own boundary means a failure there leaves the tab bar and every other screen working.

A class component is required — hooks can't implement `componentDidCatch`. It uses plain `StyleSheet` rather than `useTheme`, so a theme failure can't break the thing that renders when something has already failed. It logs `error.message` only, never a component stack that could embed rendered health data.

## Sync (item 4)

- **Onsets** → `users/{uid}/symptom_onsets`, merged **by `symptomType`, not by id** — the same symptom recorded on two devices produces two ids for one fact, and merging by id would leave both.
- **Story edits** → a single document at `users/{uid}/story_overrides/main`, matching the profile pattern. One small object, not one document per section.
- **Conflict rule for story edits: local wins.** These are sentences someone wrote about their own health. A missing section is recoverable; an overwritten paragraph is not.

Both push on write and pull in `pullAndMergeAllFromCloud()` after sign-in. All of it is inert while Firebase is unconfigured.

## Site (item 3)

`healthlit-site.zip` — `index.html`, `privacy.html`, `support.html`, self-contained, no build step. `README.md` has the GitHub Pages steps. Replace `[YOUR LEGAL ENTITY]` and point the support address somewhere you read, then **open both URLs in a private window** — a 404 there is the most common App Store rejection there is.
