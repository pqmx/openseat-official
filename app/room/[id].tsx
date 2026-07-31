import { useLocalSearchParams } from 'expo-router';
import { roomById, viewOf, type RoomView } from '../../data';
import { Room, RoomCanceled, RoomCasualPreJoin, RoomHost, RoomHostRequests } from '../../screens/Room';

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
  const room = roomById(id);
  const Screen = views[view ?? viewOf(room)];
  return <Screen room={room} />;
}
