import { Tabs } from 'expo-router';
import { TabBar } from '../../components/ui';

/**
 * The design's own tab bar — four equal slots with a labelled create button —
 * so the navigator supplies the routing and nothing else.
 */
export default function TabsLayout() {
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
