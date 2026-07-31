# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Openseat — current state

Expo ~57.0.9, react-native 0.86.2, react 19.2.3, blank-typescript. `npx tsc --noEmit` passes.

Every screen of `openseat v4.dc.html` is built and navigable. `npm run check` runs the
typecheck and the two unit checks (`time.check.ts`, `data.check.ts` — plain node, no test
framework).

- `theme.ts` — light/dark tokens transcribed verbatim from the file's two `:root` blocks.
- `time.ts` — every time string the UI shows. Pure, no React, no Intl.
- `data.ts` — typed models plus fixtures **in the shape a room API would return**. Screens
  derive every label from here (`statusOf`, `metaOf`, `feedFor`, `viewOf`). Replacing these
  constants with `fetch` is the only change the UI needs.
- `app/` — expo-router file routes, and nothing else. Each file reads its params and hands a
  plain prop to a screen; no layout or design lives here.
- `components/` — `ui.tsx` primitives, `rooms.tsx` room card/row/list, `icons.tsx`.
- `screens/` — Discover, Rooms, Room, Profile, Create, Onboarding, Report. Presentational:
  they take props and call `router`, they never read the URL.

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
| `/create`, `/create/details` | `CreateStep1` / `CreateStep2` |
| `/sign-in`, `/profile-setup` | the `(auth)` group |
| `/report` | `ReportSheet`, presented as a `formSheet` |

`(tabs)/_layout.tsx` supplies routing only — the tab bar itself is `TabBar` from `ui.tsx`,
rendered once via the `tabBar` prop, with the active slot read off the pathname.

Source of truth is `openseat v4.dc.html` (v1–v3 and `Openseat Design System.dc.html` are older).
Two deliberate departures, both because the mock was worse on a device: the create button is a
labelled tab slot rather than an off-centre floating one, and status labels read `LIVE · 22 MIN`
rather than `LIVE · 22M`.

## Not built

No backend, no auth, no persistence — creating a room navigates to `/room/new`, which falls
back to a fixture because nothing appends to `rooms`. `/` redirects everyone straight to the
feed; `/sign-in` is reachable only by URL until there's a session to check. No push
notifications. Photos are dashed placeholders (`ImageSlot`).
