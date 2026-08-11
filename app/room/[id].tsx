import { useLocalSearchParams } from 'expo-router';
import { useRooms } from '../../api';
import { roomById, viewOf } from '../../data';
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
 * One route, five drawings, and `viewOf` decides which from the data alone.
 *
 * There used to be a `?view=` override here, because joining and ending a room
 * were local state and the fixtures had no way to express the transition. Both
 * are real writes now: joining inserts a membership and the reload comes back
 * with you in the roster, so the screen changes because the room did.
 */
export default function RoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, settled, error, reload } = useRooms();
  const { me } = useSession();

  if (error) throw error;
  if (!me) return null;

  const room = roomById(rooms, id);
  // A bad id is a dead link, not room one. Saying so beats rendering somebody
  // else's room as though it were the one you asked for — and it now also
  // covers a room the database declined to send you.
  //
  // But only once the server has answered. Create pushes here the moment the
  // room exists, before any fetch has returned it, so an absent room is "not
  // yet" until `settled` — otherwise opening a room flashes a dead link at you.
  if (!room) return settled ? <NotFound /> : null;
  const Screen = views[viewOf(room, me)];
  return <Screen key={room.id} room={room} rooms={rooms} reload={reload} />;
}
