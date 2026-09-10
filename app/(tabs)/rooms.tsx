import { useRooms } from '../../api';
import { Rooms } from '../../screens/Rooms';
import { useSession } from '../../session';
import { LoadState, PrimaryButton } from '../../components/ui';
import { View } from 'react-native';

export default function RoomsRoute() {
  const { rooms, loading, error, reload, hasMore, loadMore, refreshing } = useRooms({ scope: 'mine' });
  const { me } = useSession();
  if (!me) return null;
  return <View style={{ flex: 1 }}><LoadState loading={loading} error={error} retry={reload} />
    {!loading ? <Rooms rooms={rooms} me={me} reload={reload}
      pagination={hasMore ? <PrimaryButton label="Load more rooms" disabled={refreshing} onPress={loadMore} /> : null} /> : null}</View>;
}
