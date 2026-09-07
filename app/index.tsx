import { Redirect } from 'expo-router';
import { SignIn } from '../screens/Auth';
import { useSession } from '../session';

/** Route signed-out users to sign-in and new profiles to onboarding. */
export default function Index() {
  const { session, me, error, loading, needsOnboarding } = useSession();

  if (loading) return null;
  if (!session) return <SignIn />;
  // Checked before `!me`, because a request that failed and a row that isn't
  // there both leave `me` null and only one of them is the database's fault.
  if (error) throw error;
  // The signup trigger creates the profile in the same transaction as the
  // user, so this means something is genuinely wrong rather than merely new.
  if (!me) throw new Error('Signed in, but no profile row came back for this account.');
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/discover" />;
}
