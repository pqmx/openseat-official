# Security review — September 5, 2026

Audited the current working tree and the deployed Supabase project
`openseat-app` (`odewffansajnakyeyzvu`). This replaces the outdated August review.
Existing unrelated working-tree edits were preserved.

## Fixed and deployed

- **Deleted-account tokens retained access.** Profiles intentionally survive account
  deletion, but policies previously trusted only the JWT subject. A deleted account
  could still read rooms and edit its tombstone until its token expired.
  Restrictive policies now require a matching `auth.users` row on all six public
  tables. Privileged room creation, block-list reads and Places counters check
  that account too. This addresses deletion, not immediate revocation of every
  access token after ordinary sign-out.
- **Room creation regressed in local migrations.** The host-year migration replaced
  the privileged function with an invoker and removed its time bounds. Replaying
  the original chain failed the policy suite with permission denied. Restored
  the privilege mode, retained the host-year rule, and restored time validation.
- **Concurrent requests bypassed the room creation limit.** Creation now locks
  the caller's auth row while checking its five-per-hour allowance.
- **Repeated content writes were unbounded.** Database triggers now enforce
  20 reports and 120 room updates per account per hour, including direct and bulk
  inserts. These serialize against the same account row as room creation.
- **Autocomplete could spend unlimited Google quota.** Both paths are now counted:
  300 autocomplete requests and 60 details requests per account per database day.
  The counter denies requests after the allowance without incrementing forever.
  Autocomplete sessions are not universally free; abandoned sessions are billed
  per request. See [Google's session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing).
- **Malformed Places requests and upstream failures.** The deployed handler checks
  authentication, method, body size, JSON shape and parameters before spending
  quota; requires an explicit quota approval; bounds Google calls to eight seconds;
  and returns generic failures without upstream details. JWT gateway verification
  remains enabled. The Supabase SDK import is pinned.
- **Unbounded profile payloads.** Year and major now have length limits; prompt
  entries must contain string question/answer values. The frontend also filters
  malformed prompts before rendering them.
- **Campus email enforcement only ran during signup.** A separate auth trigger
  now rejects missing/non-campus emails on insert and email change.
- Applied the previously local cleanup removing the unused `casual` column,
  preventing duplicate active blocks, and removing report foreign keys that could
  silently cascade moderation history. There were no casual rooms or duplicate
  blocks in production. No app records were removed.

## App fixes in the working tree

- Removed the second session-bootstrap request and profile fetches inside auth
  callbacks. Profile responses are invalidated when accounts change, and token
  refresh no longer reloads the profile or blanks the navigator.
- Account-scoped feed requests share an in-flight read. Late results/errors cannot
  repopulate another account's cache. Hidden tabs no longer run polling timers;
  the focused screen retains the 15-second refresh and foreground reconciliation.
- Sign-out failures are surfaced instead of claiming success.
- Font imports now include only the three used weights, removing 15 unused font
  assets from the bundle.
- Apple is disabled in deployed Supabase Auth. Its button now requires
  `EXPO_PUBLIC_APPLE_AUTH_ENABLED=true` as well as device support. Enable that
  flag only after configuring the provider; Google remains available.
- Updated vulnerable XML dependencies and the Xcode UUID dependency. Upgraded
  the deep-link decoder with a one-line CommonJS compatibility patch.
- Added minimal `image-size` guards for malformed ICNS entries and ISO image boxes,
  with timeout-based regression tests. The patches are applied by the existing
  `patch-package` postinstall workflow.
- Replaced stale security claims in the code and this report.

## Verification

- `npm ci` successfully reapplies all three dependency patches.
- `npm run check` passes TypeScript, existing checks, account-cache isolation,
  Places auth/validation/quota tests, malformed asset tests and deep-link decoding.
- **85/85 database checks pass** on an isolated local database and the live
  Supabase database. Live fixtures run inside a transaction ending in rollback.
- Concurrent creation test: eight simultaneous requests yielded five accepted
  rooms and three rate-limit refusals. This test is included in CI.
- Clean local migration replay succeeds. Post-baseline filenames match the versions
  recorded by Supabase; the older remote pre-baseline history is retained.
- Live unsigned Places calls and anonymous room reads both return HTTP 401.
- Native JavaScript/Hermes export succeeds; this is not a device OAuth login test
  or an App Store release. App-side changes still need a new app build.

## Remaining limits and operational notes

- `npm audit` reports **five high findings**, all propagated from two
  `image-size` advisories. No patched release is currently published. The installed
  code is locally patched and regression-tested, but npm evaluates package versions
  and cannot recognize those patches. Track
  [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and
  [JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq); remove the local
  patch when an upstream compatible fix is available.
- Supabase's five privileged-function warnings are expected: these RPCs enforce
  caller identity and operate on protected data. Switching room creation back to
  invoker breaks it. The private counter's RLS-without-policy notice is intentional:
  direct client access is denied; the checked privileged functions own writes.
  See [Supabase function security](https://supabase.com/docs/guides/database/functions).
- Google is enabled; email/password, anonymous sign-in and Apple are disabled.
  The old review's open email-signup warning was stale. Local config now requires
  email confirmation if email signup is used during development.
- This is a campus directory, not an anonymity boundary: visible rooms expose their
  rosters and exact venue pins. Class year is self-declared. Blocking hides the
  blocked host's rooms but is not guaranteed to hide a person's presence in a
  third party's room.
- Places limits are per-account, not a project-wide spending cap. Keep Google
  project quotas and billing alerts configured independently.
- Feed pagination remains a scaling limitation: the query caps results at 200,
  so sufficiently large histories can crowd newer rooms out. No measured query
  slowdown justified deleting the existing foreign-key/access indexes.
- The tracked-source secret-pattern scan found only examples in documentation.
  No service secret was found in app source. This was not a comprehensive scan of
  every historical commit or an external penetration test.
