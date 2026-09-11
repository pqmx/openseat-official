import { RoomHost, RoomHostRequests } from '../../screens/RoomHost';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useRoom, useNow } from '../../api';
import { viewOf } from '../../data';
import { LoadState } from '../../components/layout';
import { NotFound } from '../../screens/NotFound';
import { Room, RoomCanceled } from '../../screens/Room';
import { useSession } from '../../session';

/** Four screens behind one route; a throw in any of them stops here. */
export { RouteError as ErrorBoundary } from '../../screens/NotFound';

const views = {
  member: Room,
  host: RoomHost,
  requests: RoomHostRequests,
  canceled: RoomCanceled,
  ended: RoomCanceled,
} as const;

/** Room state and membership determine the screen. */
export default function RoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { room, loading, error, reload } = useRoom(id);
  const { me, session, loading: authLoading, needsOnboarding } = useSession();
  const now = useNow();
  if (authLoading) return <LoadState loading retry={reload} />;
  if (!session) return <Redirect href={{ pathname: '/', params: { next: `/room/${id}` } }} />;
  if (needsOnboarding) return <Redirect href={{ pathname: '/onboarding', params: { next: `/room/${id}` } }} />;
  if (!me) return <Redirect href={{ pathname: '/', params: { next: `/room/${id}` } }} />;
  // Wait for the detail request before treating a missing room as a dead link.
  if (room === undefined || error && !room) return <LoadState loading={loading} error={error} retry={reload} />;
  if (!room) return <NotFound />;
  const Screen = views[viewOf(room, me, now)];
  return <View style={{ flex: 1 }}><LoadState error={error} retry={reload} />
    <Screen key={room.id} room={room} rooms={[]} reload={reload} /></View>;
}
