# App Store Connect — copy-paste pack

Updated for the local-only v1 release on September 5, 2026.

---

## App information

**Name (30 char max)**
`HealthLit: Symptom Diary`

**Subtitle (30 char max)**
`Track symptoms, tell your story`

**Primary category:** Medical
**Secondary category:** Health & Fitness

### Age rating

Complete Apple's current age-rating questionnaire based on the content actually present in the submitted build. HealthLit contains health/wellness topics and user-entered medical information such as symptoms and medications, but does not provide treatment advice.

On Apple's current rating framework, **infrequent medical or treatment information maps to 13+**, while **frequent medical or treatment information maps to 16+** on iOS 26 and later. Do not choose a target rating first; answer the questionnaire accurately and use the rating Apple generates.

---

## Description

```
A symptom diary for people managing ongoing health concerns — built so logging takes seconds, even on a difficult day.

WHEN LOGGING NEEDS TO BE FAST
Open the app, choose what you're feeling, set the severity, and save. Every other field is optional. Log several symptoms in one sitting, each with its own details, start and end time, body location, possible triggers or reliefs, and notes.

YOUR STORY, READY FOR YOUR APPOINTMENT
Appointments are short and it can be hard to summarize weeks or months of symptoms from memory. HealthLit turns the entries you recorded into a structured summary covering when symptoms started, how often they were logged, severity over time, durations, locations, factors you marked, what you tried, and what happened alongside them.

Choose a date range, review the summary, edit sections in your own words, then print or share it as a PDF.

EVERY NUMBER IS TRACEABLE
Tap supported findings to see the entries behind them. Reports are calculated on your device from what you logged. No language model or external AI service generates your report.

HealthLit is deliberately cautious about what it claims. It reports what you recorded and how often things occurred together. It does not establish that one thing caused another.

LOCAL-FIRST AND PRIVATE
No account is required or offered in this release. Your HealthLit records stay on your device unless you intentionally export or share them. Core features work offline. No ads, no tracking, no analytics SDK, and no developer cloud upload of your health records.

ALSO INCLUDED
• Severity trends and frequency charts
• Front and back body map for marking symptom location
• Custom symptoms beyond the built-in list
• Medication list, linkable to individual entries
• Full editable history
• Local daily reminders
• Light and dark mode

IMPORTANT
HealthLit is a symptom diary, not a medical device. It does not diagnose conditions, establish causes, predict outcomes, or recommend treatment. Always speak to a qualified clinician about medical concerns.
```

**Promotional text (170 char max)**
```
Log symptoms in seconds, then turn your entries into a clear, traceable summary for your next appointment. Local-first, offline-friendly, and no account required.
```

**Keywords (100 char max, comma-separated, no spaces)**
```
symptom,tracker,chronic,pain,illness,diary,journal,log,fatigue,migraine,flare,health,doctor,report
```

**What's New (v1.0)**
```
First release.
```

---

## URLs

These files are now included under `/docs` for GitHub Pages.

| Field | Value |
|---|---|
| Privacy Policy URL | `https://tanvib4151.github.io/HealthLit/privacy.html` |
| Support URL | `https://tanvib4151.github.io/HealthLit/support.html` |
| Marketing URL | `https://tanvib4151.github.io/HealthLit/` |

**Before submission:** enable GitHub Pages for this repository using the `main` branch and `/docs` folder, then open all three URLs in a private browser window. Do not submit until they return real pages rather than 404s.

---

## App Privacy (nutrition label)

For the current local-only v1 build, answer:

**Do you or your third-party partners collect data from this app?** → **No**

Why: the shipping build does not initialize Firebase because its credentials remain intentionally unconfigured, sign-in is hidden, HealthLit records are stored on-device, local reminders do not use a push server, and there is no analytics, advertising, tracking, or crash-reporting SDK in this release.

If cloud sync, analytics, remote crash reporting, advertising, or another service that receives user data is enabled in a later build, re-answer the questionnaire before submitting that build.

---

## Notes for the reviewer

Paste into App Review Information → Notes.

```
WHAT THIS APP IS
HealthLit is a local-first symptom diary. Users record symptoms and severity, and the app can summarize their own entries into a structured document they can review or bring to a medical appointment.

NO ACCOUNT OR BACKEND REQUIRED
The submitted v1 build does not offer account creation or sign-in. Every user-facing feature works without credentials, and the app does not require a developer backend to launch or log data.

HOW TO REVIEW THE CORE FLOW
1. Launch HealthLit and acknowledge the first-run medical notice.
2. Open Log and choose a symptom.
3. Set a start time, optionally set an end time, choose a severity, and add any optional details such as body location.
4. Save the entry.
5. Use the Home date carousel to move between days and view logs for the selected day.
6. Open History to review or edit saved entries.

HOW TO REVIEW THE STORY/REPORT FLOW
The Story feature intentionally requires at least four entries in the selected period before it produces trend language. This avoids presenting a one- or two-entry observation as a pattern. You can create four quick test entries, including on earlier dates using the date selector, then open Your Story and tap Generate story. Where a report sentence exposes evidence, tapping it shows the underlying entries used for that statement.

NO DIAGNOSIS, NO MEDICAL ADVICE, NO GENERATIVE AI
HealthLit does not diagnose, establish causes, predict outcomes, or recommend treatment. Reports are produced with deterministic calculations and templated language on the device; no external AI service or language model receives the user's health records to generate a report.

DATA HANDLING
The submitted v1 build stores HealthLit records on-device. No location, camera, microphone, contacts, photos, advertising identifier, analytics, or tracking SDK is used. Local reminders are scheduled on-device and use generic notification text. Users can access the Privacy Policy and Support pages from Profile.
```

Add your App Review contact information directly in App Store Connect using the contact fields there. Do not put personal phone numbers or private email addresses into this repository.

---

## Screenshots

Apple currently allows **1–10** screenshots. For iPhone, provide a valid **6.9-inch** set; Apple can scale these for smaller iPhone sizes when appropriate.

A convenient portrait size is **1320 × 2868** (for example, iPhone 16 Pro Max). Apple also accepts other current 6.9-inch native sizes such as 1290 × 2796 and 1260 × 2736.

Suggested order:
1. Home dashboard with real test data
2. Logging flow with the start/end time selector
3. Body-map location selection
4. A generated Story/report
5. History or trends
6. PDF/export flow

Use a clean test dataset that contains no real private health information. Screenshots must not contain an alpha channel or transparency.

---

## Export compliance

`app.json` sets both `usesNonExemptEncryption: false` and `ITSAppUsesNonExemptEncryption: false`. HealthLit uses ordinary HTTPS/TLS functionality supplied by the platform and does not implement non-exempt encryption itself.

---

## Submission flow

Current Expo guidance:

```bash
npm install --global eas-cli
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

The upload goes to App Store Connect/TestFlight. Test the production build through TestFlight before manually submitting that build for App Review.
