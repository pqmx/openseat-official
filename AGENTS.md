# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Openseat — current state

Expo ~57.0.9, react-native 0.86.2, react 19.2.3, blank-typescript. `npx tsc --noEmit` passes.

Every screen of `openseat v4.dc.html` is built and navigable. `npm run check` runs the
typecheck and the one unit check (`time.check.ts`, plain node, no test framework).

- `theme.ts` — light/dark tokens transcribed verbatim from the file's two `:root` blocks.
- `time.ts` — every time string the UI shows. Pure, no React, no Intl.
- `data.ts` — typed models plus fixtures **in the shape a room API would return**. Screens
  derive every label from here (`statusOf`, `metaOf`, `feedFor`, `routeFor`). Replacing these
  constants with `fetch` is the only change the UI needs.
- `nav.ts` — push/pop stack with a `{ screen, roomId, personId }` route. No nav library.
- `components/` — `ui.tsx` primitives, `rooms.tsx` room card/row/list, `icons.tsx`.
- `screens/` — Discover, Rooms, Room, Profile, Create, Onboarding, Report.

Design states are **derived, not duplicated**: the '29 viewer, the empty feed and the five room
views come out of `feedFor` / `routeFor`, not out of copies of a screen. Keep it that way.

Source of truth is `openseat v4.dc.html` (v1–v3 and `Openseat Design System.dc.html` are older).
Two deliberate departures, both because the mock was worse on a device: the create button is a
labelled tab slot rather than an off-centre floating one, and status labels read `LIVE · 22 MIN`
rather than `LIVE · 22M`.

## Not built

No backend, no auth, no persistence — creating a room navigates to the host view but doesn't
append to `rooms`. No push notifications. Photos are dashed placeholders (`ImageSlot`).
