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
- No `WebView`, no `eval`, no plaintext-HTTP fetch. The one `Linking.openURL` is a fixed
  `maps.apple.com` scheme with `encodeURIComponent` around the user-controlled part.

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

## Closed since

### 6. Email/password sign-up — RESOLVED, no action needed

Probed directly: `POST /auth/v1/signup` returns `email_provider_disabled`. Google is the only
way in, so nobody can claim a `@ucla.edu` address they don't own, and the leaked-password
advisor is moot.

Worth keeping straight *why*, because it governs any future change: the protection isn't that
the app only offers Google. An attacker never opens the app — they POST to the auth endpoint
with the publishable key, which ships in the bundle. What protects the year-gated feed is that
the **backend** refuses every method except Google. Turn the Email provider on and the
Google-only UI stops meaning anything, because the signup trigger checks the email's domain,
not whether the person owns the inbox.

### 7. Demo rows — DELETED 2026-08-01

`delete from auth.users where id::text like '00000000-0000-4000-8000-%'`, which cascaded to
every profile, room, membership, pin and update. All seven tables are empty; the schema, the
15 policies, the 8 `private` helpers, the report queue view and the signup trigger are intact,
and `policies.check.sql` still passes 28/28 against the empty database.

## Still yours to do

### 8. No rate limit on `create_room`

One account can still open rooms in a loop. Needs infrastructure, not a policy.

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
