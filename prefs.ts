import AsyncStorage from '@react-native-async-storage/async-storage';
import { asMapsApp, type MapsApp } from './data';

/** Maps preferences stay on this device because installed apps can differ. */

const MAPS_APP = 'openseat.mapsApp';

/** `undefined` means never asked, which is what makes the chooser appear once. */
export const getMapsApp = async (): Promise<MapsApp | undefined> => {
  try {
    return asMapsApp(await AsyncStorage.getItem(MAPS_APP));
  } catch {
    // Ask again if the saved preference cannot be read.
    return undefined;
  }
};

export const setMapsApp = async (app: MapsApp) => {
  try {
    await AsyncStorage.setItem(MAPS_APP, app);
  } catch {
    // Opening the map can proceed even if the preference cannot be saved.
  }
};
