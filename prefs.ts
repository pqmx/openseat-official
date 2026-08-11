import AsyncStorage from '@react-native-async-storage/async-storage';
import { asMapsApp, type MapsApp } from './data';

/**
 * Device preferences. Not identity — that's `session.tsx`, and it lives on the
 * server because it's the same person on every device.
 *
 * Which maps app you want is the opposite: Google Maps may be installed on the
 * phone and not the tablet, so the answer belongs to the device that was asked.
 * Putting it in `profiles` would have meant a migration, a column grant, and a
 * field readable by anyone who can reach your profile — for a value that tells
 * them nothing they need. The `dorm` reasoning in SECURITY-REVIEW.md, applied
 * before the column exists rather than after.
 *
 * AsyncStorage is already here for the Supabase session (`supabase.ts`), so
 * this adds nothing to the bundle.
 */

const MAPS_APP = 'openseat.mapsApp';

/** `undefined` means never asked, which is what makes the chooser appear once. */
export const getMapsApp = async (): Promise<MapsApp | undefined> => {
  try {
    return asMapsApp(await AsyncStorage.getItem(MAPS_APP));
  } catch {
    // A storage read that fails is indistinguishable from never having been
    // asked, and asking again is the harmless outcome. Nothing here is worth
    // failing a tap on a map over.
    return undefined;
  }
};

export const setMapsApp = async (app: MapsApp) => {
  try {
    await AsyncStorage.setItem(MAPS_APP, app);
  } catch {
    // Same reasoning: the link still opens, we just ask again next time.
  }
};
