# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Openseat — current state

Expo ~57.0.9, react-native 0.86.2, react 19.2.3, blank-typescript. `npx tsc --noEmit` passes.

Design system + all 15 screens of `openseat v4.dc.html` are built:

- `theme.ts` — light/dark tokens transcribed verbatim from the file's two `:root` blocks.
- `components/icons.tsx`, `components/ui.tsx` — only what the design renders.
- `screens/` — Discover, Room, Profile, Create, Onboarding, Report.
- `App.tsx` — font loading, theme provider, and a throwaway screen picker (no navigation yet).

Source of truth is `openseat v4.dc.html` (v1–v3 and `Openseat Design System.dc.html` are older).

## Agreed scope — do not exceed

Only components and screens the design file actually renders. No invented values, no full
component library, no navigation library, no backend. Widen the scope only if the user asks.
