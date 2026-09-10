# Openseat

iPhone app for UCLA meetups. Expo 57, React Native, and Supabase.

## Development

1. Run `npm ci` and copy `.env.example` to `.env`.
2. Fill in public Supabase and Google OAuth values. Match the reversed iOS client ID to the URL scheme in `app.json`.
3. Run `npm run ios` to build the native app, then `npm start` for the development server. Expo Go and web are unsupported.

Google OAuth needs both client IDs configured in Supabase. Enable the Apple feature flag only after configuring its provider and iOS entitlement. Store `GOOGLE_PLACES_KEY` as a Supabase secret; never bundle service keys or OAuth secrets.

## Checks

- `npm run check` — TypeScript and app regressions.
- `npm run check:policies` — SQL checks using `DATABASE_URL` against a disposable migrated database.
- `npm run check:native-bridge` — Swift/C++ bridge check; requires macOS and Xcode.
- Maestro simulator flows — setup below.

Run SQL suites sequentially so fixtures do not overlap. CI's database bootstrap and migration replay are in `.github/workflows/checks.yml`.

## Project layout

- `app/`: routes; `screens/` and `components/`: UI.
- `api.ts`: server calls; `data.ts`: models and pure derivations; `session.tsx`: account state.
- `supabase/migrations/`: schema history; `supabase/functions/`: server functions.
- `patches/`: native/dependency fixes applied by `npm ci`.

## Simulator tests

Install Maestro and an EAS `e2e` simulator build (`com.pqmx.openseat`). That build uses the `preview` environment: point it at a dedicated test Supabase project, never production.

Sign in manually with a UCLA-eligible test account before authenticated flows. OAuth provider dialogs are manual tests; there is no authentication bypass.

| Command | Account/setup | Coverage |
| --- | --- | --- |
| `npm run e2e:smoke` | Completed profile | Tabs and account menu |
| `npm run e2e:write` | Completed profile | Places lookup, create room, host view, close room |
| `npm run e2e:onboarding` | Separate account with profile year reset to NULL | Onboarding and Discover routing |
| `npm run e2e:signed-out` | Run last; clears the saved session | Cold launch and auth gate |

Two-account joins, reports/blocks, and account deletion need separately resettable test accounts. These flows do not cover native provider sign-in or replace physical-device testing.

## Release

Apply compatible migrations before shipping the client, and rebuild the native app after native dependency changes.

Visible rooms expose rosters and venue pins before approval. Class year is self-declared. Blocking hides a blocked host's rooms, but not necessarily their presence in another host's room. Configure Google project quotas and billing alerts separately from per-account limits.

### Accounts and services

- [ ] Apple Developer membership, App Store Connect record (`com.pqmx.openseat`), and production EAS signing credentials.
- [ ] Production Supabase/public environment values, Google OAuth client IDs and iOS URL scheme, server-only Places key, and Sentry/source-map credentials.
- [ ] Configure Apple Sign In for the App ID and Supabase before enabling its app feature flag.
- [ ] Verify UCLA and g.ucla.edu sign-in; reject non-campus and Apple relay addresses. Keep production email/password and anonymous signup disabled.
- [ ] Apply migrations before the client release; run policy checks on a disposable production-like database and verify staging API compatibility.

### Policies and operations

- [ ] Publish privacy, community guidelines, support, and safety contact URLs.
- [ ] Set retention periods for profiles, rooms, updates, reports, blocks, account tombstones, Places counters, and crash reports.
- [ ] Assign moderation ownership, alerts, response targets, escalation, and suspension procedures.
- [ ] Configure Google project quotas/billing alerts and verify Sentry source maps and alerts.
- [ ] Verify anonymous access is denied and no service secrets ship in the app.

### Release testing and submission

- [ ] Run app, database, static-analysis, and Maestro checks.
- [ ] Rebuild native dependencies and test a production-mode TestFlight build on physical iPhones.
- [ ] Test sign-in/cancellation, onboarding, account switching/deletion, and shared-link cold launch.
- [ ] With two accounts, test create/request/approve/decline/join/withdraw/leave, host closure, four-hour expiry, concurrent last-seat requests, and report/block/unblock.
- [ ] Test maps, sheet gestures, pagination, keyboards, offline recovery, VoiceOver, text scaling, Reduce Motion, dark mode, and the smallest supported iPhone.
- [ ] Complete App Store metadata, screenshots, privacy/age-rating/export/content-rights forms, and provide a UCLA-eligible review account with navigation instructions.

Android, iPad, and push notifications are deferred. Active screens poll for changes; release copy must not promise push alerts.
