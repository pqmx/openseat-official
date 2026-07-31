import { createContext, useContext } from 'react';

/** Every screen the design mocks. The app is a plain stack over these. */
export type ScreenName =
  | 'discover'
  | 'discoverEmpty'
  | 'discoverFreshman'
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

/**
 * A push/pop stack in `useState` — 15 screens with their own back buttons and
 * no native headers don't earn a navigation library.
 * ponytail: swap for expo-router when deep links or URLs are needed.
 */
export const NavContext = createContext<{
  go: (screen: ScreenName) => void;
  /** Replaces the stack — for flows you shouldn't be able to back out of. */
  reset: (screen: ScreenName) => void;
  back: () => void;
}>({ go: () => {}, reset: () => {}, back: () => {} });

export const useNav = () => useContext(NavContext);
