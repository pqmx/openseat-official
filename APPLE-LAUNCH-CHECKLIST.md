# Apple launch checklist

This is the work that cannot be completed safely from the repository alone. The first release is **iPhone-only**. iPad support and real-time/push notifications are deliberately out of scope.

## Accounts and credentials to obtain

- [ ] Active Apple Developer Program membership.
- [ ] App Store Connect app record for bundle ID `com.pqmx.openseat`.
- [ ] Production EAS credentials and App Store Connect API key.
- [ ] Production Supabase project URL and publishable key.
- [ ] Google OAuth web and iOS client IDs, with the iOS URL scheme matching `app.json`.
- [ ] Server-only Google Places key stored as a Supabase secret.
- [ ] Production Sentry DSN and source-map upload credentials.

Never put an Apple private key, OAuth client secret, Supabase secret/service-role key, Places key, or Sentry auth token in an `EXPO_PUBLIC_` variable.

## Policies and public URLs

- [ ] Publish a privacy policy describing account/profile data, approximate and precise room locations, reports/blocks, Supabase, Google Places, Google Sign-In, Apple Sign In, and Sentry.
- [ ] Publish community guidelines covering harassment, threats, impersonation, scams, discrimination, unsafe locations, and enforcement.
- [ ] Publish a monitored support and safety contact URL/email.
- [ ] Document retention periods for rooms, room updates, reports, blocks, deleted-account tombstones, Places counters, and Sentry events.
- [ ] Complete App Store Connect App Privacy, age rating, export compliance, and content-rights questionnaires to match production behavior.

## Supabase production settings

- [ ] Disable email/password sign-in, or require email confirmation. The shipped UI uses Apple and Google only.
- [ ] Confirm both `ucla.edu` and `g.ucla.edu` accounts work while non-UCLA and Apple relay addresses are rejected.
- [ ] Apply every migration and run `npm run check:policies` against a disposable production-like database.
- [ ] Configure report alerts, a moderator owner/rotation, response targets, escalation steps, and account suspension enforcement.
- [ ] Verify that anonymous callers cannot read user or room data and that the service-role key never ships in the app.

## App Store submission

- [ ] Supply iPhone screenshots, name, subtitle, description, keywords, category, copyright, privacy URL, and support URL.
- [ ] Give App Review a controlled UCLA-eligible review account and clear navigation instructions; do not add a client-side bypass.
- [ ] Confirm Sign in with Apple is enabled for the App ID and Supabase provider.
- [ ] Set every production environment variable in EAS and build a clean release archive.
- [ ] Upload a TestFlight build and complete the device test plan below before submission.

## Automated and physical-device checks

- [ ] Run `npm run check`, `npm run doctor`, `npm run check:policies`, and the Maestro suites documented in `.maestro/README.md`.
- [ ] On a physical iPhone, test first and returning Apple sign-in, Google sign-in, cancellation, and rejected non-UCLA identities.
- [ ] Test onboarding, create/join/request/approve/decline/leave/cancel, report/block/unblock, account deletion, and a cold relaunch.
- [ ] Disable connectivity while viewing each primary screen; confirm the offline banner appears, retry works, and failed mutations explain what happened.
- [ ] Test VoiceOver, accessibility text sizes, Reduce Motion, light/dark mode, and the smallest supported iPhone.
- [ ] Send a production-mode Sentry test event and verify symbolicated source maps and alerts.

## Explicitly deferred

- Android builds and store material.
- iPad layouts and screenshots.
- Push and real-time notifications. Users must reopen or refresh the app to see room changes; launch copy must not promise instant alerts.
