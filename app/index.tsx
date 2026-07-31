import { Redirect } from 'expo-router';

/**
 * Entry route. There is no session yet, so everyone lands in the feed.
 * ponytail: this is the gate — when Google Sign-In is wired it becomes
 * `return signedIn ? <Redirect href="/discover" /> : <GoogleSignIn />`.
 * The hand-drawn `/sign-in` and `/profile-setup` screens were deleted rather
 * than left to rot: Google owns that flow now, and the UCLA-specific fields it
 * can't supply — year, major, dorm — want designing against what it actually
 * returns rather than against a guess.
 */
export default function Index() {
  return <Redirect href="/discover" />;
}
