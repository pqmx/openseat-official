# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Openseat — current state

Expo ~57.0.9, react-native 0.86.2, react 19.2.3, blank-typescript. `npx tsc --noEmit` passes.

Every screen of `openseat v4.dc.html` is built and navigable. `npm run check` runs the
typecheck and the three unit checks (`time.check.ts`, `data.check.ts`, `snap.check.ts` —
plain node, no test framework).

`policies.check.sql` is the fourth check and the only one `npm run check` can't run, because
the rules it covers aren't in the app — they're RLS policies in Postgres. Run it with
`psql "$DATABASE_URL" -f policies.check.sql`; every row must read `ok = t`. It builds its own
four students and six rooms and ends in `rollback`, so it needs no seed data and leaves
nothing behind. Every row it writes is attempted **as a signed-in student**, which is the
only way to test a policy honestly.

Discover is on a real map: `react-native-maps`, with rooms carrying `lat`/`lng`, behind a
three-stop draggable sheet (`components/sheet.tsx`). Selecting a room fills the sheet with
`RoomPreview` rather than navigating.

- `theme.ts` — light/dark tokens transcribed verbatim from the file's two `:root` blocks.
- `time.ts` — every time string the UI shows. Pure, no React, no Intl.
- `data.ts` — typed models and every derivation (`statusOf`, `metaOf`, `feedFor`, `viewOf`).
  Pure: no React, no network, no fixtures. **The viewer is always an argument** — there is no
  module-level `you` any more, because a real session can't be a constant.
- `supabase.ts` — the client. `api.ts` — the queries, mapping rows into `data.ts` shapes, plus
  `useRooms` / `useNow`. `session.tsx` — who you are, ambient like the theme (`useSession`).
- `app/` — expo-router file routes, and nothing else. Routes **fetch and gate**; they hand
  plain props down. A load failure is thrown so the layout's ErrorBoundary renders it.
- `components/` — `ui.tsx` primitives, `rooms.tsx` room card/row/list/preview/roster,
  `sheet.tsx` the draggable sheet, `icons.tsx`.
- `screens/` — Discover, Rooms, Room, Profile, Create, Report, Auth, NotFound. Presentational:
  they take props and call `router`, they never read the URL.
- `snap.ts` — where a released sheet drag lands. Pure, so `snap.check.ts` can run it.

Design states are **derived, not duplicated**: the '29 viewer, the empty feed and the five room
views come out of `feedFor` / `viewOf`, not out of copies of a screen. Keep it that way.

## Routes

| URL | Screen |
| --- | --- |
| `/` | the session gate: `SignIn`, else `/onboarding`, else `/discover` |
| `/onboarding` | year/major/dorm — the fields Google doesn't return |
| `/discover`, `/discover?year='29` | `Discover`; the year is the viewer, not a second screen |
| `/rooms` | `Rooms` |
| `/you` | `ProfileEmpty` — your own profile |
| `/profile/[id]` | `Profile` — someone else's; inside `(tabs)`, hidden from the bar |
| `/room/[id]` | one of five, picked by `viewOf` — and only by `viewOf`; the `?view=` override is gone |
| `/create`, `/create/details` | `CreateStep1` / `CreateStep2`; step 1 passes `title`/`place` as params |
| `/report?room=&person=&name=` | `ReportSheet`, presented as a `formSheet`; the ids are written, `name` only addresses the sheet |
| anything else | `NotFound` — including `/room/[id]` for an id that isn't a room |

`(tabs)/_layout.tsx` supplies routing only — the tab bar itself is `TabBar` from `ui.tsx`,
rendered once via the `tabBar` prop, with the active slot read off the pathname.

Source of truth is `openseat v4.dc.html` (v1–v3 and `Openseat Design System.dc.html` are older).
Four deliberate departures, all because the mock was worse on a device:

- the create button is a labelled tab slot rather than an off-centre floating one;
- status labels read `LIVE · 22 MIN` rather than `LIVE · 22M`;
- the report sheet's dimmed backdrop is gone. The mock drew a fake room behind the sheet
  because it had no modal to put one behind; `presentation: 'formSheet'` leaves the real
  screen showing, so the backdrop was fixture text pretending to be whatever you were
  actually looking at;
- the member room screen has a join footer. The design only ever drew that screen joined, but
  `viewOf` sends non-members of an open room there, so it has to be the screen you join from.

The ⋯ on your own profile used to open the report sheet — offering to report yourself. It
signs you out now, which had no button anywhere in the app before.

## Backend

Supabase project `openseat-app` (`odewffansajnakyeyzvu`). Keys in `.env` — see `.env.example`.

`profiles`, `rooms`, `room_pins`, `room_members`, `room_updates`, `reports`. The app model's
`attendees` and `requests` are one `room_members` table with a `state`; the host holds a
membership row too, so `is_member` needs no special case for them.

**Every write is a policy, not a button.** Join, ask-to-join, approve, decline, leave, post
update, end room and report are real inserts, updates and deletes; what each is allowed to do
is decided in `public`'s RLS policies and the `private` helpers behind them, never in the
screen. A screen that sends the wrong statement gets refused, not obeyed.

Two consequences worth knowing before you touch any of it:

- **A refusal is often silent.** An insert that fails `with check` raises, but an update or
  delete whose `using` clause matches nothing simply succeeds having touched no row. Every
  write in `api.ts` therefore asks for the affected rows back and treats an empty result as
  the refusal it is (`changed()`). Skip that and "Leave room" reports success while leaving
  you in the room.
- **Never read a row's own columns through an RLS-filtered subselect to decide access.**
  `room_members_insert_self` first did exactly that, and for a room you couldn't see the
  subselect returned null — which, for `years`, means "any year", so hiding the room is what
  let you into it. `private.can_see_room(uuid)` is security definer for this reason. There is
  a regression case for it in `policies.check.sql`.

Column grants do what RLS can't: `authenticated` may update only `rooms.canceled_at`,
`room_members.state`, and `profiles.year/major/dorm`. So "end the room" can't become
"rewrite the room", and onboarding can't become "rename yourself to somebody else".

Blocking is real and symmetric — `private.blocked_with()` is folded into `can_see_room`, so a
block hides that person's rooms in both directions, which is what the report sheet promises.

Reports are readable by their author and nobody else, so triage runs as the service role:
`private.report_queue` is a view of untriaged reports with both sides named, and
`reports.reviewed_at` / `reviewed_note` are where handling gets recorded. It is not granted to
`authenticated` — the app cannot read it.

**Two rules the client used to enforce are now the database's.** Don't move them back:

- **Year visibility.** `rooms_select` refuses to return a room your `profiles.year` can't see.
  `feedFor`'s year filter is belt-and-braces, not the enforcement.
- **Casual-room addresses.** RLS is row-level and can't hide one column, so exact coordinates
  live in their own table, `room_pins`, behind their own policy. A non-member simply receives
  no row, which is why `Room.lat`/`lng` are optional — undefined is the server saying no.
  `rooms.approx_lat`/`approx_lng` are rounded to 3dp (~110m) and everyone who can see the room
  gets them, so the map can still draw its 150m circle without knowing the door.

`private.is_member()` lives outside `public` so PostgREST can't expose it as an RPC. Signup is
gated to `@ucla.edu` / `@g.ucla.edu` by a trigger on `auth.users`, which also seeds the profile
from Google's name. `create_room` is a `security invoker` function so the insert policies
authorise it; it exists for atomicity — room, pin and host membership in one transaction.

**The database is empty.** The 9 demo students and 8 demo rooms transcribed from the old
fixtures were deleted on 2026-08-01, along with the `auth.users` rows behind them; nothing has
signed in since. So every screen opens on its empty state until a real UCLA account creates
something, and Discover having no pins is correct rather than broken.

Nothing in the repo depends on that data: `policies.check.sql` builds its own four students
and six rooms and rolls them back.

## Not built

No realtime — `useNow` still polls every 30s, and a write reloads by refetching. No push
notifications, which is what "You'll get a ping for each one" on the room screen is still
promising. No rate limit on `create_room`: one account can open rooms in a loop.

No account deletion or data export, which is a real gap for an app that stores which dorm a
student sleeps in.

**No photos.** People are initials (`Avatar`) everywhere, including both profile screens.
There's no upload path, so a photo placeholder was a promise the app couldn't keep.

## Building

**Google Sign-In needs a dev build** — it's native, so Expo Go can't run it. It also needs two
OAuth client IDs from the Google Cloud console, which nothing in the repo can generate:

1. A **web** client. Its ID and secret go into Supabase → Auth → Providers → Google, and its ID
   into `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Supabase verifies the ID token against the web
   client even on iOS.
2. An **iOS** client, bundle ID `com.openseat.app`. Its ID goes into
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and its *reversed* form into `app.json` under the
   `@react-native-google-signin/google-signin` plugin as `iosUrlScheme`.

Until both exist, sign-in throws a named error rather than failing obscurely.

`.npmrc` sets `legacy-peer-deps`. Expo SDK 57 ships its own peer mismatch — `expo-router` pulls
`vaul`/radix, which pull `react-dom@19.2.8`, which wants `react@^19.2.8` while Expo pins
`19.2.3`. Both are web-only and this app is native. Without it, `npm install` of anything at
all fails with ERESOLVE.

`patches/expo-modules-jsi+57.0.4.patch` works around a Swift ambiguity that stops Expo SDK 57
compiling under Xcode 26.3. Delete it once Expo ships a fix. `pod install` also needs
`LANG=en_US.UTF-8` on Ruby 4 / CocoaPods 1.16.

**Android needs a Google Maps API key** in `app.json` under
`expo.android.config.googleMaps.apiKey`, or the map renders blank. This isn't optional and
isn't a `react-native-maps` quirk: Android has no system map to embed, so the only renderer is
Google's SDK, and Google requires a key. iOS needs none — it defaults to Apple Maps, and only
wants a key if you opt into `PROVIDER_GOOGLE`.
