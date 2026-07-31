# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Openseat — current state

Scaffold done: Expo ~57.0.9, react-native 0.86.2, react 19.2.3, blank-typescript.
`npx tsc --noEmit` passes. Nothing else is built yet.

## Next task

Import the design project via the `claude_design` MCP:
https://claude.ai/design/p/fd459e77-1200-46f0-b9e2-64405ca1dfb5?file=Openseat+Design+System.dc.html

Files: `Openseat Design System.dc.html` (primary) and `support.js` (imported by it).

## Agreed scope — do not exceed

Tokens + only the components the design file actually renders.

1. One `theme.ts`: colors, spacing, typography, radii. Straight from the file, no invented values.
2. Only components visibly used in the design — Button, Card, etc. Skip any component that is
   defined but unused. No full component library, no screens.

Decided 2026-07-30. Widen the scope only if the user asks.
