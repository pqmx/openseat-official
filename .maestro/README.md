# iOS end-to-end tests

These flows run against an installed iOS simulator build with bundle ID
`com.pqmx.openseat`. They do not add an authentication bypass or mock the
backend: authenticated flows exercise the E2E Supabase project with a dedicated
UCLA-eligible test account.

## Prerequisites

1. Install the [Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro).
2. Build the `e2e` EAS profile and install the resulting `.app` on an iOS
   simulator.
3. Put only E2E/test-project public values in the EAS `preview` environment.
   Never point destructive tests at production.
4. Sign in once with the dedicated completed-profile account. Native Google and
   Apple provider sheets remain a manual contract test; the app does not contain
   a review or test-only sign-in bypass.

## Commands

```sh
# Always runnable; clears app state and verifies the public auth gate.
npm run e2e:signed-out

# After signing in once with a completed-profile E2E account.
npm run e2e:smoke

# Creates a real room, checks the host view, then ends it.
npm run e2e:write

# Use a separate E2E account whose profile year is NULL. This flow mutates that
# account, so reset its year before running it again.
npm run e2e:onboarding
```

Run the signed-out flow last: `clearState: true` intentionally removes the
session used by the other flows.

## What is covered

- Cold signed-out routing and the UCLA authentication gate.
- Authenticated tab navigation and the account menu, including visibility of
  Apple-required account deletion without actually deleting the test account.
- First-run onboarding and routing into Discover.
- A real Places lookup, two-step room creation, host-room rendering, and room
  cancellation cleanup.

Provider sign-in dialogs, a second-account join/request flow, report/block, and
account deletion require separately resettable accounts. Add those only after
the E2E project has server-side fixtures/reset automation; tests must not create
a client-only auth bypass or run destructive writes against production.

