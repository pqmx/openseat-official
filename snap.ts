/**
 * Where a released drag lands. Pure so `snap.check.ts` can run it under plain
 * node, same as `time.ts` — the sheet's only real logic lives here rather than
 * inside a worklet, where nothing can reach it.
 */

/**
 * Snap offsets are measured from the top of the sheet's container, so a
 * *smaller* offset is a *more open* sheet. Callers pass them in whatever order
 * reads well; only the distances matter.
 */
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
