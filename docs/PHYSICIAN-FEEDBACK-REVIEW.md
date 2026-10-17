# Physician feedback implementation review

Base: `main` at `8333b618736b2382fd719b0082dd66823790a2de`. Fresh branch: `physician-feedback-complete`. The preliminary branch was inspected: two commits changed ProfileScreen and added follow-up notes. Its bulk-clear removal and five interview questions were incorporated without copying its demo replacement interface. No merge, deployment, app submission or SDK upgrade was performed.

## Implemented behavior

1. Descriptive insights are available immediately, including counts, recorded days and date ranges. The report-wide 14/20-day gate is removed; each pattern keeps its own evidence criteria. Missing days remain unknown. Missing logs no longer create “resolved” findings; changes describe recording frequency.
2. Per-symptom continuity: Continuous, Comes and goes, Not sure; optional exact/approximate episode counts; optional observation window stored separately from active symptom duration.
3. Morning/Afternoon/Evening/Night/Not sure, optional exact minute-level time, optional duration including one minute, approximate duration and ongoing. Today/Yesterday/Another date controls accept a validated calendar date. Invalid exact time blocks continuation/saving. No shared time range silently assigns duration to multiple symptoms.
4. Numerical 0–10 scale retained; mild/moderate/severe labels and severity gradients removed from interactive and printed views. Tappable numbers and screen-reader adjustment replace the dragging dial.
5. Shared controls wrap text, grow vertically and use generous targets; chips now follow the selected light/dark theme. Header text gets explicit line height, padding and shrink behavior. Core text/control contrast is tested in both themes. This is targeted AA work, not a claim of full WCAG conformance.
6. Home places symptom recording first, removes streak messaging, weekly trend and comparison analytics; History/Insights/Story retain detailed views.
7. History exports all active raw records to UTF-8 CSV through native sharing, with a web download fallback. The CSV includes identity, timestamps, original calendar date/timezone where known, precision, continuity, count, window, duration, numerical severity and all patient notes/arrays. Arrays are JSON within quoted cells. Missing optional values remain blank. Formula-like text receives a leading apostrophe; exported raw timestamps are unchanged. Temporary native export files are deleted after the share flow closes. Errors do not modify records.
8. Bulk clear and the development demo-replacement interface are removed. Individual editing remains; deletion has an explicit per-entry confirmation and tombstone persistence. Existing account deletion remains available when Firebase is configured.
9. Storage architecture, a reversible future migration plan and the five-question interview checklist are documented separately in PHYSICIAN-FEEDBACK-FOLLOWUPS.md.

## Validation and limitations

Validation results are recorded below after final checks. Tests use synthetic fixtures and mocked native storage/share/print APIs; they do not access patient data or a real account.

### Accessibility checks performed

- Source review of Dynamic Type defaults (no font-scaling cap added), flexible shared buttons/chips, wrapped choice rows, numeric severity selection, accessibility role/state/label/value/actions, error announcements and native-share entry point.
- Automated WCAG contrast calculation for core foreground/background combinations in light and dark themes. Failures found during implementation were corrected.
- Source investigation of the HealthLit wordmark: increased line height and vertical padding; allowed shrinking instead of relying on inherited heading metrics. No iPhone root cause has been confirmed.

### Device checks still required

- iPhone 15 Pro: reproduce the original wordmark clipping with the installed Inter fonts, then verify portrait/landscape, light/dark, default text and all larger accessibility text sizes.
- VoiceOver: verify focus order, number selection, adjustable actions, errors, date/time fields, confirmation, history editing, deletion and share-sheet cancellation.
- Native iOS/Android: validate CSV Unicode contents in Files/Numbers/Excel and PDF printing/sharing on a real device. Native APIs are mocked in automated tests.
- Manual whole-app contrast/focus/touch-target audit and enlarged-text reflow, including existing body maps, charts and navigation. This environment has no native simulator.

### Screenshots

No screenshots are supplied. The local web export succeeds, but installed Chromium was unavailable; Playwright's browser download returned truncated archives and failed. No visual rendering or device checks are represented as completed.

### Remaining engineering limits

- Legacy records cannot reveal continuity, timing precision or original timezone that was never recorded. Their existing fields remain intact and legacy/unknown duration is identified.
- Approximate duration choices keep the architecture's numerical estimates plus an explicit description/precision; summaries display the approximate description.
- Counts/windows/durations accept positive whole numbers up to 100,000; durations are minutes. Exact time uses 24-hour HH:MM; custom dates use YYYY-MM-DD.
- CSV formula protection deliberately changes dangerous cell text by adding an apostrophe. Missing fields are blank, not invented zeros. Downloads/share destinations are controlled by the user.
- Existing optional Firebase rules need coordinated review/deployment before a future release using new optional fields. No live Firestore emulator/rules deployment or real-account sync test was performed. Old clients do not understand deletion tombstones. Future robust sync remains deferred.
- Dependency audit findings are reported; no unrelated upgrades were made. expo-file-system 19.0.24 was already present transitively and is now declared directly for CSV file creation.

## Commands and actual results

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; 851 packages installed, existing deprecation warnings. |
| `npm run typecheck` | Passed after implementation fixes. |
| `npm test` | 17 tests passed, 0 failed. Includes sparse summaries, missing days, timing precision, intermittent windows, one-minute duration, legacy edit/read preservation, timezone preservation, failed saves, deletion/restart/merge, CSV escaping and native share failures, HTML/PDF record representation, invalid-time prevention, and core light/dark contrast. |
| `npm run test:story` | Passed for all five synthetic patient profiles; provenance, language, adversarial and snapshot checks passed. |
| `node -r ./tests/register.cjs tools/chartProbe.ts` | Passed; five charts rendered cleanly as SVG with data tables. This checks generated markup, not visual screenshots. |
| `node -r ./tests/register.cjs tools/lexiconProbe.ts` | Passed: no collisions or false positives in the probe; negation checks held. |
| `npx expo-doctor` | 18/18 checks passed. |
| `npx expo export --platform web --output-dir /tmp/healthlit-web-final` | Passed; local web bundle produced. No hosting/publication. |
| `git diff --check` | Passed. |
| `npm audit --omit=dev --audit-level=high` | Exit 1: 52 findings (18 moderate, 33 high, 1 critical) in the existing dependency graph. No package versions were upgraded. The only dependency declaration added is the already-resolved Expo filesystem package. |
| Playwright screenshot attempt / `playwright install chromium` | Failed: no installed browser; download attempts returned truncated archives. No screenshots were captured. |

The original golden test run on untouched `main` also failed two snapshots (episodic note-descriptor wording and sparse body-region spelling). The branch's five snapshots were deliberately regenerated and reviewed for the new continuity/precision/unknown-day wording as well as that existing drift; the language/provenance assertions were not weakened.

## Exact changed-file manifest

- `.github/workflows/release-check.yml`
- `components/entries/EntryListItem.tsx`
- `components/log/ContinuityFields.tsx`
- `components/log/TimeRangePicker.tsx`
- `components/ui/AppHeader.tsx`
- `components/ui/Button.tsx`
- `components/ui/Chip.tsx`
- `docs/PHYSICIAN-FEEDBACK-FOLLOWUPS.md`
- `docs/PHYSICIAN-FEEDBACK-REVIEW.md`
- `firestore.rules`
- `package-lock.json`
- `package.json`
- `screens/HistoryScreen.tsx`
- `screens/HomeScreen.tsx`
- `screens/InsightsScreen.tsx`
- `screens/LogScreen.tsx`
- `screens/ProfileScreen.tsx`
- `screens/StoryScreen.tsx`
- `services/csvExportService.ts`
- `services/entryStorage.ts`
- `services/reportService.ts`
- `store/logStore.ts`
- `tests/physician-feedback.test.cjs`
- `tests/register.cjs`
- `tests/storage-export.test.cjs`
- `tools/golden/constant.txt`
- `tools/golden/episodic.txt`
- `tools/golden/improving.txt`
- `tools/golden/severityOnly.txt`
- `tools/golden/sparse.txt`
- `types/models.ts`
- `utils/chartSvg.ts`
- `utils/correlationAnalyzer.ts`
- `utils/csv.ts`
- `utils/entryStats.ts`
- `utils/healthEvents.ts`
- `utils/observation.ts`
- `utils/storyEngine.ts`
- `utils/storyFindings.ts`
- `utils/storyGate.ts`
- `utils/storyNlg.ts`
- `utils/storyProgression.ts`
- `utils/storyReport.ts`
- `utils/symptoms.ts`
- `utils/theme.ts`
- `utils/trendData.ts`
