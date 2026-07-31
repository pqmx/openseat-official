# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Openseat — current state

Expo ~57.0.9, react-native 0.86.2, react 19.2.3, blank-typescript. `npx tsc --noEmit` passes.

Every screen of `openseat v4.dc.html` is built and navigable. `npm run check` runs the
typecheck and the three unit checks (`time.check.ts`, `data.check.ts`, `snap.check.ts` —
plain node, no test framework).

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
| `/room/[id]` | one of five, picked by `viewOf`; `?view=` overrides for transitions the fixtures can't express |
| `/create`, `/create/details` | `CreateStep1` / `CreateStep2`; step 1 passes `title`/`place` as params |
| `/report` | `ReportSheet`, presented as a `formSheet` |
| anything else | `NotFound` — including `/room/[id]` for an id that isn't a room |

`(tabs)/_layout.tsx` supplies routing only — the tab bar itself is `TabBar` from `ui.tsx`,
rendered once via the `tabBar` prop, with the active slot read off the pathname.

Source of truth is `openseat v4.dc.html` (v1–v3 and `Openseat Design System.dc.html` are older).
Two deliberate departures, both because the mock was worse on a device: the create button is a
labelled tab slot rather than an off-centre floating one, and status labels read `LIVE · 22 MIN`
rather than `LIVE · 22M`.

## Backend

Supabase project `openseat-app` (`odewffansajnakyeyzvu`). Keys in `.env` — see `.env.example`.

`profiles`, `rooms`, `room_pins`, `room_members`, `room_updates`, `reports`. The app model's
`attendees` and `requests` are one `room_members` table with a `state`; the host holds a
membership row too, so `is_member` needs no special case for them.

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

The demo rows (9 students, 8 rooms) are transcribed from the old fixtures. **Delete them before
launch.**

## Not built

**Writes, other than create-room and onboarding.** Join, ask-to-join, approve/decline, post
update, leave, end room and submit report are all still local `useState` or a `?view=` URL
param — they look like they work and don't. The insert policies are deliberately narrow (you
may only insert yourself into a room you host), so adding a button means adding a policy.

No realtime — `useNow` still polls every 30s. No push notifications.

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
