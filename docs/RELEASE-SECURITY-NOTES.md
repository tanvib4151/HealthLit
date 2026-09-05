# HealthLit v1 release security notes

**Reviewed:** September 5, 2026

## Automated checks

The release workflow performs:

- clean dependency installation with `npm ci`
- TypeScript compilation with `tsc --noEmit`
- `expo-doctor`
- a report-only `npm audit --omit=dev --audit-level=high`

At the time of this review, TypeScript and all 18 Expo Doctor checks pass.

## npm audit findings

`npm audit` reports transitive advisories through the Expo/Metro toolchain. The high-severity entries are currently rooted in:

- `image-size`, pulled through Metro/Expo tooling
- `postcss`, pulled through Expo Metro configuration

Moderate entries include `decode-uri-component` through React Navigation / Expo Router and `uuid` through Expo config tooling.

The audit's proposed automatic remediation requires breaking dependency changes, including a major Expo SDK jump. A forced audit fix is therefore **not** being applied to the v1 release candidate.

These findings are primarily in dependency/build/configuration paths rather than HealthLit's own health-data processing code. They should still be re-evaluated when upgrading Expo SDK after v1, and the report-only audit remains in CI so changes are visible rather than silently ignored.

## Release policy

Do not run `npm audit fix --force` on the release branch without separately validating the resulting Expo/React Native versions on a physical device and through TestFlight.

For the next Expo SDK upgrade:

1. Re-run the production audit.
2. Confirm whether the transitive advisories are resolved upstream.
3. Run the full TestFlight acceptance matrix in `APP-STORE-CHECKLIST.md`.
4. Re-check App Privacy and medical-language behavior before shipping.
