# START HERE

Everything in this list is something **only you can do**. All the code work is finished.

---

## 1. Install dependencies (5 min) — do this first

The project's `package.json` was missing 14 of the 27 packages the code imports. It ran on your machine because they were already in `node_modules`; a clean build would have failed in under a minute.

```powershell
cd C:\Users\danie\Downloads\healthlit-step1\healthlit-working-backup

npx expo install @expo-google-fonts/inter @react-native-async-storage/async-storage `
  @react-navigation/bottom-tabs expo-auth-session expo-font expo-linear-gradient `
  expo-notifications expo-print expo-sharing expo-splash-screen expo-web-browser `
  firebase react-native-svg zustand

npx expo install --fix
npx expo-doctor
```

Use `npx expo install`, **not** `npm install` — it picks versions matching your SDK. I haven't hardcoded versions because your `package.json` says `expo ~54.0.0` while the current SDK is 57, and only you can confirm which (`npx expo --version`).

Then **commit `package.json` and `package-lock.json`.** This was the single biggest risk in the project.

Also: **delete `utils/storyPatterns.ts`** if it's still there. It's superseded.

## 2. Build and test on a real iPhone (30 min + ~20 min waiting)

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform ios
```

Install it and use the whole app: complete onboarding, log a multi-symptom session, generate a report, tap a sentence, export a PDF, force-quit and reopen, try dark mode.

**Expect to find something.** The app has never run outside Expo Go. Two things I especially can't verify from here:

- **`expo-notifications`** — the daily reminder. Written defensively (it degrades to "reminders unavailable" rather than crashing) but never run on a device.
- **`react-native-svg`** — the body map.

## 3. Apple Developer Program — start today

$99/year. Individual accounts clear in 24–48h; **organisation accounts need a D-U-N-S number and can take two weeks or more.** If you haven't started, this is the binding constraint and nothing else matters until it's done.

## 4. Host the privacy policy and support page (15 min)

`healthlit-site.zip` → three self-contained HTML files. Its README has the GitHub Pages steps.

Before submitting: replace `[YOUR LEGAL ENTITY]`, use **healthlithub@gmail.com** as the support mailbox, and **open both URLs in a private window.** A dead privacy policy link is the most common App Store rejection there is.

## 5. Decide three things

**Bundle ID.** Currently `com.healthlit.app`. Change it now if you own a domain — **it cannot be changed after your first upload.**

**Firebase.** Ships with placeholder credentials, and the app now detects that: sign-in hides itself, sync no-ops, everything else works. **My recommendation is to ship v1 exactly like this** — the app is local-first, nothing depends on it, and your privacy answer becomes "we don't collect data", which is a simpler and stronger listing. Add sync in 1.1. To enable it instead, paste real values into `services/firebaseConfig.ts` and deploy `firestore.rules`.

**Developer Tools in Profile.** "Load Demo Data" is visible to users. The reviewer notes tell App Review to use it, so leave it for v1 — but decide deliberately.

## 6. Screenshots (30 min)

6.9" (1320 × 2868). Load Demo Data first so nothing is empty. Suggested order is in `APP-STORE-METADATA.md`; lead with the generated report, since that's the thing nothing else does.

## 7. Submit

Fill in the three `REPLACE_WITH_` fields in `eas.json`, then:

```powershell
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

Paste everything from `APP-STORE-METADATA.md` into App Store Connect. **Push to TestFlight first** and give it 24 hours of real use — TestFlight review is much lighter than App Store review, so it costs almost nothing and catches what one testing session misses.

---

# What changed in this build

## New: onboarding

First launch previously showed an empty dashboard with no explanation — the most common way a health app loses someone in thirty seconds. Now three steps: what it does, an optional daily reminder, and the medical disclaimer. Short on purpose; someone downloading a symptom diary may be unwell right now.

The disclaimer is folded in as the final step rather than being a second stacked modal.

## New: daily reminders

Local notifications only — no server, no device token, nothing transmitted. **The notification text contains no health information**, because it appears on a lock screen potentially in front of other people: "Time for your check-in", never a symptom or a severity.

Configurable in Profile, and honest when permission is denied rather than showing a switch that silently springs back.

This is the feature that decides whether the app is still useful in three months. A symptom diary lives or dies on adherence.

## New: app icon

The old one was a generic white heart on pink, which didn't match the lavender design system. The new mark is a heart with an ECG trace cut through it — clipped to the silhouette so it reads cleanly at 58px on a home screen. Regenerated at all four sizes, with the App Store icon flattened to RGB (alpha causes a hard upload rejection).

## New: README

Written for a repo visitor, and doubles as expo material — it leads with why the engine refuses to claim things, which is the genuinely interesting part.

---

# For the school expo

The 30-second version to show someone:

1. **Profile → Load Demo Data**
2. **Home → Your Story → Generate story**
3. **Tap any sentence with a number in it**

That third tap is the moment. The report opens the exact readings each claim was computed from — no AI product can do that, because a generated sentence has no retrievable relationship to the rows behind it.

If someone asks a harder question, the strongest answer is the adversarial test:

> One of our test patients only logs when they feel terrible. Severity always drops afterwards, no matter what they did — that's regression to the mean. Most trackers would tell that person their heat pack works. Our build **fails** if the engine says that.

Run `npx tsx tools/storyGolden.ts` in front of them if you want to prove it.

---

# Still open

Caretaker mode isn't built. `DailyLog` in `types/models.ts` is dead code. `Intl` date formatting needs checking on a physical Android device before you ship that platform — iOS is fine.
