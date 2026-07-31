import { useLocalSearchParams } from 'expo-router';
import { useRooms } from '../../api';
import { Discover } from '../../screens/Discover';
import { useSession } from '../../session';

/** Discover carries the map and the sheet — the most that can go wrong. */
export { RouteError as ErrorBoundary } from '../../screens/NotFound';

/**
 * `/discover?year='29` is the freshman feed — same screen, different viewer.
 * The year-gated rooms drop out of `feedFor`, so the map, the list and the
 * count all thin together. Without the param you see it as yourself.
 *
 * Note this now only ever *narrows*: the database already refused to send a
 * room your own year can't see, so the param can't be used to look at someone
 * else's feed.
 */
export default function DiscoverRoute() {
  const { year } = useLocalSearchParams<{ year?: string }>();
  const { rooms, loading, error } = useRooms();
  const { me } = useSession();
  if (error) throw error;
  if (loading || !me) return null;
  return <Discover rooms={rooms} me={me} viewerYear={year} />;
}
