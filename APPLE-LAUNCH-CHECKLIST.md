# iPhone release checklist

## Accounts and services

- [ ] Apple Developer membership, App Store Connect record (`com.pqmx.openseat`), and production EAS signing credentials.
- [ ] Production Supabase/public environment values, Google OAuth client IDs and iOS URL scheme, server-only Places key, and Sentry/source-map credentials.
- [ ] Configure Apple Sign In for the App ID and Supabase before enabling its app feature flag.
- [ ] Verify UCLA and g.ucla.edu sign-in; reject non-campus and Apple relay addresses. Keep production email/password and anonymous signup disabled.
- [ ] Apply migrations before the client release; run policy checks on a disposable production-like database and verify staging API compatibility.

## Policies and operations

- [ ] Publish privacy, community guidelines, support, and safety contact URLs.
- [ ] Set retention periods for profiles, rooms, updates, reports, blocks, account tombstones, Places counters, and crash reports.
- [ ] Assign moderation ownership, alerts, response targets, escalation, and suspension procedures.
- [ ] Configure Google project quotas/billing alerts and verify Sentry source maps and alerts.
- [ ] Verify anonymous access is denied and no service secrets ship in the app.

## Release testing and submission

- [ ] Run app, database, static-analysis, and [Maestro checks](.maestro/README.md).
- [ ] Rebuild native dependencies and test a production-mode TestFlight build on physical iPhones.
- [ ] Test sign-in/cancellation, onboarding, account switching/deletion, and shared-link cold launch.
- [ ] With two accounts, test create/request/approve/decline/join/withdraw/leave, host closure, four-hour expiry, concurrent last-seat requests, and report/block/unblock.
- [ ] Test maps, sheet gestures, pagination, keyboards, offline recovery, VoiceOver, text scaling, Reduce Motion, dark mode, and the smallest supported iPhone.
- [ ] Complete App Store metadata, screenshots, privacy/age-rating/export/content-rights forms, and provide a UCLA-eligible review account with navigation instructions.

Android, iPad, and push notifications are deferred. Active screens poll for changes; release copy must not promise push alerts.
