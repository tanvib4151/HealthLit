# App Store submission — status and plan

## The honest answer on timing

**Live on the App Store this weekend is not achievable.** Submitted for review by the weekend is achievable *if* your Apple Developer account already exists and device testing goes cleanly. I'd rather tell you that now than have you find out on Sunday.

Here's what's actually in the way, in order of severity:

**1. The project could not build.** `package.json` declared 12 dependencies while the code imports 27. `zustand`, `firebase`, `async-storage`, `expo-print`, `react-native-svg` and ten others were missing. It runs on your machine because they're in your `node_modules` from earlier installs, but EAS Build starts from a clean container and installs from `package.json` — it would have failed in under a minute. This is fixed by one command below.

**2. The app has never run on a physical iPhone.** Expo Go is not a standalone build. Things that routinely work in Expo Go and break in a real build: custom fonts, the splash screen handoff, `react-native-svg`, `expo-glass-effect`, and AsyncStorage persistence. You cannot skip this step, and it's the one most likely to eat a day.

**3. Apple Developer Program enrolment.** $99/year. Individual accounts usually clear in 24–48h; organisation accounts need a D-U-N-S number and can take **two weeks or more**. If you haven't started this, it is the binding constraint and nothing else matters until it's done. Start it today.

**4. Review time.** Median is ~24h, but Medical-category apps get read properly. Budget for one rejection round.

Realistic best case, assuming the account exists: build and device-test Thursday/Friday, submit Saturday, live mid-next-week.

---

## What I've already done

| Item | Status |
|---|---|
| App Store icon had an alpha channel | **Fixed** — flattened to RGB. This causes `ITMS-90717` and a hard upload rejection |
| No bundle identifier | **Fixed** — `com.healthlit.app` (change if you own a domain) |
| No version/build number | **Fixed** — 1.0.0 / build 1, with `autoIncrement` for later builds |
| No `eas.json` | **Fixed** — dev/preview/production profiles |
| Export compliance prompt on every build | **Fixed** — `ITSAppUsesNonExemptEncryption: false`, accurate since you're HTTPS-only |
| iOS privacy manifest | **Added** — UserDefaults reason code, required since 2024 |
| No medical disclaimer | **Added** — first-run, acknowledged once, stored locally |
| No privacy policy | **Drafted** — `PRIVACY-POLICY.md`, matches actual data flows |
| Store metadata | **Written** — `APP-STORE-METADATA.md`, paste-ready |
| Privacy nutrition labels | **Answered** — same file |
| Reviewer notes | **Written** — same file |

---

## Step 1 — Fix dependencies (5 minutes, do this first)

```powershell
cd C:\Users\danie\Downloads\healthlit-step1\healthlit-working-backup

npx expo install zustand firebase react-native-svg `
  @react-native-async-storage/async-storage @react-navigation/bottom-tabs `
  @expo-google-fonts/inter expo-font expo-splash-screen expo-print `
  expo-sharing expo-linear-gradient expo-web-browser expo-auth-session `
  expo-glass-effect

npx expo install --fix
npx expo-doctor
```

Use `npx expo install`, **not** `npm install`. It picks versions matching your SDK; I deliberately haven't hardcoded them, because your `package.json` says `expo ~54.0.0` while the current SDK is 57 and I can't verify which you're on from here. Run `npx expo --version` to confirm — it determines every other version.

If peer conflicts appear, `--legacy-peer-deps` as usual.

**Then commit `package.json` and `package-lock.json`.** This was the single biggest risk in the project and it should never regress.

## Step 2 — Build for a real device (30 min, then ~20 min of waiting)

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform ios
```

Install the resulting build on your iPhone and **use the whole app**: log a multi-symptom session, generate a report, tap a sentence to open the evidence sheet, export a PDF, force-quit and reopen to confirm data persisted, then try it in dark mode.

Expect to find something. That's the point of this step.

## Step 3 — Decisions only you can make

**Firebase.** `services/firebaseConfig.ts` still contains `apiKey: 'YOUR_API_KEY'` — sign-in doesn't work at all right now. Two options:

- **Ship v1 without sign-in** (my recommendation). The app is local-first; nothing depends on it. You remove a whole class of review risk, and your privacy answer becomes "we don't collect data", which is both simpler and a genuinely better listing. Add sync in 1.1.
- **Configure Firebase properly** — real credentials, verify `firestore.rules` are deployed, and test sign-in on device. That's most of a day, and rules being wrong is how health apps end up in the news.

If you go with option one, hide the Profile → "Back up & Sync" entry point and answer **No** to data collection.

**Developer Tools in Profile.** "Load Demo Data" and "Clear All Data" are visible to users. Reviewers actually need Load Demo Data (my reviewer notes tell them to use it), so leave it for v1 — but decide deliberately rather than by accident.

**Bundle ID.** `com.healthlit.app` is a placeholder. If you own a domain, use reverse-DNS of it. **This cannot be changed after your first upload.**

## Step 4 — App Store Connect

1. Enrol in the Apple Developer Program if you haven't. **Today.**
2. Host the privacy policy publicly. GitHub Pages, 15 minutes.
3. Create the app record in App Store Connect, bundle ID matching `app.json`.
4. Paste everything from `APP-STORE-METADATA.md`.
5. Screenshots at 6.9" (1320 × 2868), with demo data loaded.
6. Production build and submit:

```powershell
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Fill in the three `REPLACE_WITH_` fields in `eas.json` first (Apple ID, App Store Connect app ID, Team ID).

## Step 5 — TestFlight

Push to TestFlight before submitting for review and give it 24 hours with you and your co-founder using it daily. TestFlight review is much lighter than App Store review, so this costs you almost nothing and catches the things device testing in one sitting misses.

---

## Likely rejection reasons, ranked

1. **Privacy policy URL missing or 404s.** The most common rejection full stop. Test the link in a private browser window.
2. **Medical claims.** Mitigated: the language lint blocks causal and diagnostic phrasing, the disclaimer is first-run, and the reviewer notes address it directly. Your description copy is the remaining exposure — don't add "discover your triggers" style claims later.
3. **Guideline 2.1 — incomplete information.** Reviewers who can't find the main feature reject. The reviewer notes walk them through Load Demo Data step by step.
4. **Crash on launch.** Almost always something that works in Expo Go and not in a standalone build. Step 2 is the mitigation.
5. **Sign-in that doesn't work.** Currently guaranteed, given the placeholder API key. Either fix it or remove it.

---

## What I could not do from here

- Enrol you in the Apple Developer Program
- Run EAS Build (needs your Apple credentials and provisioning)
- Test on a physical device
- Host the privacy policy
- Take screenshots
- Configure real Firebase credentials

## Still open from before

Onboarding screen, caretaker mode, `DailyLog` dead type, and sync for the two new entities (onsets, story edits) — none of which block submission.
