import { Redirect, useLocalSearchParams } from 'expo-router';
import { safeRoomDestination } from '../room-rules';
import { LoadState } from '../components/layout';
import { SignIn } from '../screens/Auth';
import { useSession } from '../session';
import { useWrite } from '../feedback';

/** Route signed-out users to sign-in and new profiles to onboarding. */
export default function Index() {
  const { session, me, error, loading, needsOnboarding, reloadMe } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = safeRoomDestination(next);
  const { run } = useWrite();

  if (loading) return <LoadState loading retry={reloadMe} />;
  if (!session) return <SignIn />;
  // Checked before `!me`, because a request that failed and a row that isn't
  // there both leave `me` null and only one of them is the database's fault.
  if (error) return <LoadState error={error} retry={() => { void run(reloadMe); }} />;
  // The signup trigger creates the profile in the same transaction as the
  // user, so this means something is genuinely wrong rather than merely new.
  if (!me) return <LoadState error={new Error('Profile unavailable')} retry={() => { void run(reloadMe); }} />;
  if (needsOnboarding) return <Redirect href={{ pathname: '/onboarding', params: { next: destination } }} />;
  return <Redirect href={destination as '/discover'} />;
}
