import { Redirect } from 'expo-router';

/**
 * Entry route. There is no auth yet, so everyone lands in the feed;
 * `/sign-in` is still reachable by URL.
 * ponytail: this is where the session check goes when sign-in is real —
 * `return signedIn ? <Redirect href="/discover" /> : <Redirect href="/sign-in" />`.
 */
export default function Index() {
  return <Redirect href="/discover" />;
}
