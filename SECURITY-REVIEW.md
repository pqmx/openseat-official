# Security review — 2026-08-01

Scope: secret handling, the client bundle, and the RLS surface that actually enforces the
rules (`AGENTS.md` says the database is the enforcement, so that's where the bugs were).

Everything below marked **fixed** is applied to `openseat-app` (`odewffansajnakyeyzvu`) as
three migrations: `tighten_profile_and_member_visibility`,
`bound_free_text_and_coordinates`, `fix_rooms_select_returning_snapshot`.

## Clean

- **No secrets in the repo or in git history.** `.env` is gitignored and was never committed
  (`git log --all -- .env` is empty); nothing tracked matches a JWT / `service_role` /
  `GOCSPX` / `AIza` / PEM pattern.
- **The key in the bundle is the right one.** `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is
  `sb_publishable_*`, not `sb_secret_*`. Publishable keys are meant to ship; RLS is the
  protection, and RLS is on for all six tables.
- **The reversed client ID in `app.json` is not a secret.** OAuth client IDs and their URL
  schemes are public by design; the secret half lives only in Supabase.
- **No Android Maps key in `app.json`** — nothing to leak. When you add one, restrict it to
  package name + SHA-1 in the Cloud console.
- `handle_new_user` and `private.is_member` are `security definer` with `search_path = ''`.
  `create_room` is `security invoker`, so the insert policies authorise it — no escalation.
- No `WebView`, no `eval`, no plaintext-HTTP fetch. Both `Linking.openURL` calls go through
  `mapsUrl` in `data.ts` — fixed `https://maps.apple.com` / `https://www.google.com` hosts,
  numeric coordinates, and `encodeURIComponent` around the one user-controlled part
  (`room.place`). The Apple link was `http://` and searched by address text until 2026-08-01;
  it is https and coordinate-based now, and a non-member's link carries the 3dp approximation
  rather than the exact pin the server withheld.

## Fixed

### 1. `profiles_select` was `USING (true)` — HIGH

Any signed-in student could dump every profile in one request: `name`, `year`, `major`,
`dorm`, `interests`, `prompts`. Now:

```sql
using (id = (select auth.uid()) or private.shares_room(id))
```

**Read the limit honestly.** This makes the API expose exactly what the UI exposes, no more —
you can reach a profile only through a room you can see. It does *not* make the directory
private, because open rooms are visible to everyone and their rosters are public, so anyone
can still walk rooms → rosters → profiles. On the demo data (9 users, fully interconnected) a
signed-in student still reaches all 9; a viewer with no year reaches 8 of 9 instead of 9. At
real scale, where rooms are year-gated and time-limited, it genuinely restricts.

If you want the directory actually private, that's a product decision, not a policy tweak —
see "Your call" below.

### 2. Pending join requests were visible to everyone — MEDIUM

`room_members_select` returned every row of any visible room, `state` included, so anyone
could watch who asked to join and hadn't been let in. Pending rows are now the requester's and
the host's business only. Verified on the one room that has them: host sees 3, the requester
sees their own 1, a bystander sees 0.

Note this changes what the app shows today — `room.requests` (`api.ts:81`) is now empty for
non-hosts. That is the intended behaviour, and it is what the host-only approve/decline UI
would have needed anyway.

### 3. Hosts couldn't see their own year-gated rooms — latent `create_room` failure

Pre-existing, found while testing the above. `rooms_select` had no host clause, so a '27 host
opening a room for `['29]` could not see the row they had just written — and `create_room`
does `insert ... returning`, which applies the SELECT policy. The call failed with *"new row
violates row-level security policy"*. `private.can_see_room` now starts with
`p_host = auth.uid()`. Both create paths verified.

### 4. Nothing bounded free text or coordinates — LOW

`create_room` checked capacity and access; the insert policies only ever checked *who* was
writing, never *what*. Added length caps on `rooms.title/place/street/blurb`,
`room_updates.body`, `reports.reason/detail`, a `capacity <= 100` ceiling, lat/lng range
checks on `room_pins` and `rooms.approx_*`, and a check that a report names either a room or a
person. Caps are generous — the longest real row is a 88-char blurb — they exist to stop a
loop writing megabytes, not to shape the UI.

### 5. The writes shipped, and each one came with its policy — follow-up pass

Join, ask-to-join, approve, decline, leave, post update, end room and report were local state;
they're real writes now, and every rule they appear to enforce lives in an RLS policy. Two
findings came out of building them, both caught by `policies.check.sql` rather than by review:

- **A fail-open access check.** `room_members_insert_self` read the room's `years` with a
  scalar subselect, which is itself RLS-filtered — so for a room you couldn't see it returned
  null, and a null `years` means "any year". Hiding the room was what let you into it. Fixed
  by using the security-definer `private.can_see_room(uuid)`; there's a regression case for it.
- **Silent refusals.** An update or delete whose `using` clause matches nothing succeeds
  having touched no row. Four of my own checks scored as passing for this reason, and the
  client had the same hole: `api.ts` now asks for affected rows back and treats an empty
  result as a refusal. Without it, "Leave room" reports success while leaving you in the room.

Column grants were narrowed so `authenticated` can update only `rooms.canceled_at`,
`room_members.state` and `profiles.year/major/dorm` — ending a room can't rewrite it, and
onboarding can't rename you to somebody else. `anon`'s blanket DML grants were revoked; no
policy named it, so nothing changes today, but a later policy without a role clause would.

Moderation has a reader now: `private.report_queue`, plus `reports.reviewed_at`/`reviewed_note`.
It isn't granted to `authenticated`, so triage needs the service role. Blocking is real and
symmetric, folded into `can_see_room`.

## Still yours to do

### 6. Email/password sign-up — REOPENED 2026-08-04, was closed, deliberately

This section used to read "RESOLVED, no action needed" because `POST /auth/v1/signup` returned
`email_provider_disabled`. **The Email provider is on now, and email confirmation is being
turned off**, on purpose, to get off Google while auth isn't the work. So the thing this
section predicted has happened, and it should be read as the open risk it is:

> Turn the Email provider on and the Google-only UI stops meaning anything, because the signup
> trigger checks the email's domain, not whether the person owns the inbox.

That is now the state. **Anyone who can type any `@ucla.edu` or `@g.ucla.edu` string gets an
account**, without ever receiving mail at it — and they don't need the app to do it, they POST
to the auth endpoint with the publishable key that ships in the bundle. The year-gated feed,
the roster and every "someone from UCLA" promise rest on that address, so what's protecting
them right now is nothing.

Two ways to close it, and the app supports both without a code change:

- Turn **Confirm email** back on (Authentication → Sign In / Providers → Email). Owning the
  inbox becomes the check again; `signUp` already handles the no-session response by telling
  you to go read your mail.
- Or put Google back and turn the Email provider off, which returns the backend to refusing
  every method but one — the shape that closed this the first time.

The leaked-password advisor stops being moot while this is open, too: real passwords exist now.

## Closed since

### 7. Demo rows — DELETED 2026-08-01

`delete from auth.users where id::text like '00000000-0000-4000-8000-%'`, which cascaded to
every profile, room, membership, pin and update. All seven tables are empty; the schema, the
15 policies, the 8 `private` helpers, the report queue view and the signup trigger are intact,
and `policies.check.sql` still passes 28/28 against the empty database.

## Still yours to do

### 8. No rate limit on `create_room`

One account can still open rooms in a loop. Needs infrastructure, not a policy.

### 9. Place search is signed-in-only, but not rate limited — same shape as #8

`places-search` gates on `auth.getUser()`, so a stranger can't spend the Google quota. A
signed-in student still can, and each call is billed. The 350ms debounce and the 3-character
floor are client-side and therefore not the enforcement — anyone can POST the function
directly with their own token. Bounded today by a daily quota cap in the Cloud console, which
caps the bill without stopping the abuser. A per-user counter belongs here eventually.

## Corrections to the second pass

**I got the Places key wrong first time.** The location field originally called
`places:searchText` straight from `api.ts` with `EXPO_PUBLIC_GOOGLE_PLACES_KEY`, and both
`AGENTS.md` and `.env.example` said restricting the key to bundle `com.openseat.app` made
that safe. It does not. Google's iOS/Android application restrictions bind their **native
SDKs**; the REST web service doesn't honour them, and App Check doesn't cover it either.
Google's recommended restriction for the Places web service is `IP addresses`, with an
explicit note that this is impractical for mobile apps and that those should use a proxy
server. The key would have been extractable from the binary with no working restriction
behind it, on a per-request-billed API.

Now: `supabase/functions/places-search`, key held as a Supabase secret, session checked
before the call. Worth keeping straight *why*, because it generalises to the next key —
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ships safely and this one couldn't, and the difference
isn't the prefix. It's that RLS stands behind the publishable key and nothing stands behind a
Places key. Before bundling any credential, name what enforces the limit when someone holds
it. If the answer is "the app wouldn't do that", it isn't enforcement.

## Resolved by deletion

**`dorm` is gone** — dropped from `profiles`, from `Person`, from onboarding and from the
profile screen. It was the field that made finding #1 more than a privacy nuisance: it named
the building a stranger sleeps in, it was readable by anyone who could reach the profile, and
it fed nothing — no filter, no matching, no distance.

Worth recording the reasoning, because it generalises. The options were to guard it (move it
to a `profile_private` table behind its own policy, the way `room_pins` guards exact
coordinates) or to remove it. Guarding is the right answer for a field that earns its keep;
`room_pins` exists because the map genuinely needs coordinates. `dorm` earned nothing, so the
cheaper and stronger answer was to delete it: a column that isn't there can't be leaked by the
next policy someone writes. Nothing was lost — no account had ever set one.

The remaining exposure from finding #1 is now name, class year, major, interests and prompts,
which is a directory of the kind the product is visibly meant to be.

## Corrections to my first pass

- I reported `room_members` had no unique key. Wrong — `room_members_pkey` is already
  `unique (room_id, profile_id)`. My constraint query filtered to `c`/`u` and missed the
  primary key. Duplicate memberships were never possible.
- `api.ts:159` said `create_room` is `security definer`. It's invoker, which is the safer and
  correct choice. Comment fixed in the same pass.

## Verification

`npm run check` passes. Under simulated sessions (`set local role authenticated` with a
forged `sub`), for a stranger, a '29 student and a host: no visible `rooms` /`room_members` /
`room_updates` row points at a profile the viewer can't read, so no embed in `fetchRooms`
comes back null and `toPerson` can't crash. Year gating still holds — stranger 5 rooms,
Emi ('29) 6, Maya (hosts 3) 8.

Not verified on a device — the policy changes are checked against the queries in `api.ts`,
not against a running build.
