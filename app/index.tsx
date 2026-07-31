import { Redirect } from 'expo-router';
import { SignIn } from '../screens/Auth';
import { useSession } from '../session';

/**
 * Entry route, and the session gate this file was always reserved for. Three
 * states, in order: no session at all, a session whose profile is missing the
 * year the feed is gated on, and a student who can go straight to the map.
 */
export default function Index() {
  const { session, me, loading, needsOnboarding } = useSession();

  if (loading) return null;
  if (!session) return <SignIn />;
  // The signup trigger creates the profile in the same transaction as the
  // user, so this means something is genuinely wrong rather than merely new.
  if (!me) throw new Error('Signed in, but no profile row came back for this account.');
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/discover" />;
}
