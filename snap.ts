
/** Smaller offsets open the sheet further. Snap order does not affect distance selection. */
export const nearestSnap = (offset: number, snaps: number[], velocity = 0) => {
  // Called from the gesture's UI-thread callback; under plain node the
  // directive is an inert string, so `snap.check.ts` runs it unchanged.
  'worklet';
  // A flick should carry past the closest snap. 0.15s of travel at the release
  // speed is the usual projection — long enough to skip a neighbour, short
  // enough that a slow drag still lands where you let go.
  const projected = offset + velocity * 0.15;
  let best = 0;
  for (let i = 1; i < snaps.length; i++) {
    if (Math.abs(snaps[i] - projected) < Math.abs(snaps[best] - projected)) best = i;
  }
  return best;
};
