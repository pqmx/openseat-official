import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../components/ui';
import { useSession } from '../../session';

/**
 * The design's own tab bar — four equal slots with a labelled create button —
 * so the navigator supplies the routing and nothing else.
 *
 * It also gates the whole tab group: without this, a deep link straight to
 * `/discover` while signed out renders a permanently blank screen, because
 * every tab waits on a `me` that is never coming.
 */
export default function TabsLayout() {
  const { session, loading, needsOnboarding } = useSession();

  if (loading) return null;
  if (!session) return <Redirect href="/" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <TabBar />}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="rooms" />
      <Tabs.Screen name="you" />
      {/* Someone else's profile keeps the tab bar, but isn't a tab. */}
      <Tabs.Screen name="profile/[id]" options={{ href: null }} />
    </Tabs>
  );
}
