import { useLocalSearchParams } from 'expo-router';
import { useRooms } from '../../api';
import { roomById, viewOf, type RoomView } from '../../data';
import { NotFound } from '../../screens/NotFound';
import { Room, RoomCanceled, RoomCasualPreJoin, RoomHost, RoomHostRequests } from '../../screens/Room';
import { useSession } from '../../session';

/** Five screens behind one route; a throw in any of them stops here. */
export { RouteError as ErrorBoundary } from '../../screens/NotFound';

const views = {
  member: Room,
  host: RoomHost,
  requests: RoomHostRequests,
  casual: RoomCasualPreJoin,
  canceled: RoomCanceled,
} as const;

/**
 * One route, five drawings. `viewOf` decides from the data who you are to the
 * room; `?view=` overrides it for the transitions the fixtures can't express —
 * ending a room you host, or joining one you were only looking at.
 */
export default function RoomRoute() {
  const { id, view } = useLocalSearchParams<{ id: string; view?: RoomView }>();
  const { rooms, loading, error } = useRooms();
  const { me } = useSession();

  if (error) throw error;
  if (loading || !me) return null;

  const room = roomById(rooms, id);
  // A bad id is a dead link, not room one. Saying so beats rendering somebody
  // else's room as though it were the one you asked for — and it now also
  // covers a room the database declined to send you.
  if (!room) return <NotFound />;
  const Screen = views[view ?? viewOf(room, me)];
  return <Screen key={room.id} room={room} rooms={rooms} />;
}
