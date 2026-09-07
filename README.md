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
- [Maestro flows](.maestro/README.md) — simulator checks.

Run SQL suites sequentially so fixtures do not overlap. CI's database bootstrap and migration replay are in `.github/workflows/checks.yml`.

## Project layout

- `app/`: routes; `screens/` and `components/`: UI.
- `api.ts`: server calls; `data.ts`: models and pure derivations; `session.tsx`: account state.
- `supabase/migrations/`: schema history; `supabase/functions/`: server functions.
- `patches/`: native/dependency fixes applied by `npm ci`.

## Release

Use the [release checklist](APPLE-LAUNCH-CHECKLIST.md). Apply compatible migrations before shipping the client, and rebuild the native app after native dependency changes.

Visible rooms expose rosters and venue pins before approval. Class year is self-declared. Blocking hides a blocked host's rooms, but not necessarily their presence in another host's room. Configure Google project quotas and billing alerts separately from per-account limits.
