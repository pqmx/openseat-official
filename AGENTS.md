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
- `data.ts` — typed models plus fixtures **in the shape a room API would return**. Screens
  derive every label from here (`statusOf`, `metaOf`, `feedFor`, `viewOf`). Replacing these
  constants with `fetch` is the only change the UI needs.
- `app/` — expo-router file routes, and nothing else. Each file reads its params and hands a
  plain prop to a screen; no layout or design lives here.
- `components/` — `ui.tsx` primitives, `rooms.tsx` room card/row/list/preview/roster,
  `sheet.tsx` the draggable sheet, `icons.tsx`.
- `screens/` — Discover, Rooms, Room, Profile, Create, Report, NotFound. Presentational:
  they take props and call `router`, they never read the URL.
- `snap.ts` — where a released sheet drag lands. Pure, so `snap.check.ts` can run it.

Design states are **derived, not duplicated**: the '29 viewer, the empty feed and the five room
views come out of `feedFor` / `viewOf`, not out of copies of a screen. Keep it that way.

## Routes

| URL | Screen |
| --- | --- |
| `/` | redirect to `/discover` — where the auth gate goes |
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

## Not built

No backend and no persistence. `createRoom` appends to `rooms` in memory, so a room you make
is real until the process dies — that function is the seam a `POST` replaces. No push
notifications.

**No auth.** `/` redirects everyone to the feed; `app/index.tsx` is where the session gate
goes. The hand-drawn `/sign-in` and `/profile-setup` screens were deleted deliberately —
Google Sign-In owns that flow, and the fields it can't supply (year, major, dorm) should be
designed against what it actually returns.

**No photos.** People are initials (`Avatar`) everywhere, including both profile screens.
There's no upload path, so a photo placeholder was a promise the app couldn't keep.

## Building

`patches/expo-modules-jsi+57.0.4.patch` works around a Swift ambiguity that stops Expo SDK 57
compiling under Xcode 26.3. Delete it once Expo ships a fix. `pod install` also needs
`LANG=en_US.UTF-8` on Ruby 4 / CocoaPods 1.16.

**Android needs a Google Maps API key** in `app.json` under
`expo.android.config.googleMaps.apiKey`, or the map renders blank. This isn't optional and
isn't a `react-native-maps` quirk: Android has no system map to embed, so the only renderer is
Google's SDK, and Google requires a key. iOS needs none — it defaults to Apple Maps, and only
wants a key if you opt into `PROVIDER_GOOGLE`.
