import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../components/tab-bar';
import { LoadState } from '../../components/ui';
import { useSession } from '../../session';

/** Gate all tabs on an authenticated, onboarded profile. */
export default function TabsLayout() {
  const { session, me, loading, needsOnboarding, reloadMe } = useSession();

  if (loading) return <LoadState loading retry={reloadMe} />;
  if (!session || !me) return <Redirect href="/" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    // Tabs default to `animation: 'none'`, which is a hard cut — the next
    // screen is simply there on the next frame. 'fade' rather than 'shift'
    // because shift slides sideways, and sideways already means "deeper into
    // the stack" everywhere else in this app.
    <Tabs
      screenOptions={{ headerShown: false, animation: 'fade' }}
      tabBar={() => <TabBar />}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="rooms" />
      <Tabs.Screen name="you" />
      {/* Someone else's profile keeps the tab bar, but isn't a tab. */}
      <Tabs.Screen name="profile/[id]" options={{ href: null }} />
    </Tabs>
  );
}
