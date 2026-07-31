import { createContext, useContext } from 'react';

/** Every screen the app can show. */
export type ScreenName =
  | 'discover'
  | 'rooms'
  | 'room'
  | 'roomHost'
  | 'roomHostRequests'
  | 'roomCasual'
  | 'roomCanceled'
  | 'profile'
  | 'profileEmpty'
  | 'create1'
  | 'create2'
  | 'signIn'
  | 'onboard'
  | 'report';

/** A screen plus what it's showing. */
export type Route = { screen: ScreenName; roomId?: string; personId?: string };

/**
 * A push/pop stack in `useState` — screens draw their own back buttons and
 * there are no native headers, so a navigation library earns nothing here.
 * ponytail: swap for expo-router when deep links or URLs are needed.
 */
export const NavContext = createContext<{
  route: Route;
  go: (screen: ScreenName, params?: Omit<Route, 'screen'>) => void;
  /** Replaces the stack — for flows you shouldn't be able to back out of. */
  reset: (screen: ScreenName, params?: Omit<Route, 'screen'>) => void;
  back: () => void;
}>({
  route: { screen: 'discover' },
  go: () => {},
  reset: () => {},
  back: () => {},
});

export const useNav = () => useContext(NavContext);
