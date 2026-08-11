## Backend & auth

### 6. `places-search` edge function returned 404 / non-2xx

**Symptom:** Create's location search failed silently, then later surfaced as `Edge Function
returned a non-2xx status code`.

**Root cause:** the function existed in the repo (`supabase/functions/places-search/index.ts`)
but had never been deployed — `list_edge_functions` returned `[]`, and
`get_logs(service: 'edge-function')` showed a plain 404 on every call.

**Fix:** deployed via the Supabase MCP's `deploy_edge_function`, with `verify_jwt: false` —
the function does its own `auth.getUser()` check in code, which `AGENTS.md` calls out
deliberately ("the thing it protects should be visible in the file that depends on it"), so
the platform-level gate would be redundant with, not additive to, that design.

### 7. Google Sign-In: "passed nonce and nonce in id_token should either both exist or not exist"

**Symptom:** sign-in failed at the Supabase token-exchange step, after Google's own consent
flow completed successfully.

**Root cause:** traced through `@react-native-google-signin/google-signin`'s JS types, its
native iOS bridge, and the underlying `GoogleSignIn` CocoaPod (9.1.0) — none of them expose a
way to pass or forward a nonce. Confirmed against the npm registry that 16.1.4 is genuinely
the latest release, and its own README lists "custom nonce support" as a **paid** feature of
the maintainer's commercial fork. Confirmed against Supabase's own current docs
(`search_docs`) that this exact combination — native Google Sign-In on iOS — is expected to
need this setting; it's in their own React Native / Expo quickstart, not a workaround.

**Fix:** no app code changed. Enabled **Skip nonce check** in the Supabase Dashboard
(Authentication → Providers → Google) — not available through any MCP tool, had to be done
manually. Documented tradeoff: this does remove one layer of replay protection on the token
exchange, which is Supabase's own stated cost of the setting, not something introduced here.

### 8. "Signed in, but no profile row came back for this account"

**Symptom:** thrown immediately after a successful Google sign-in; force-closing and
reopening the app reproduced the exact same error every time.

**Root cause investigation:** first suspected the database — checked `auth.users`,
`public.profiles`, the `handle_new_user` trigger, and the `profiles_select` RLS policy
directly via SQL. All correct: the trigger had inserted a matching profile row in the same
transaction as the signup, and the policy unconditionally allows `id = auth.uid()` self-reads.
The actual bug was a **React race condition** in `session.tsx`: `session` state updated to
the real value the moment sign-in completed, but `loading` and `me` lagged one render behind
— they were only synchronized by a second effect keyed on `reloadMe`'s identity, which fires
a render *after* `session` changes, not in the same one. `app/index.tsx` could observe a
frame where `session` was truthy, `loading` was `false`, and `me` was still `null` from
before, and threw. Worse: once the ErrorBoundary caught that throw, it unmounted the
provider — canceling the very fetch that would have set `me` correctly a moment later. Not
timing-dependent flakiness; a guaranteed one-frame gap on every session transition.

**Fix:** restructured `session.tsx` so `setSession` and `setLoading(true)` are called
synchronously together at both call sites (`getSession().then(...)` and
`onAuthStateChange(...)`), so React batches them into a single render. Removed the separate
`[session]`-keyed effect entirely; `loadPerson(s)` now takes the session explicitly instead
of closing over it, which also removes a stale-closure risk the old `reloadMe` had.