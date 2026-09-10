import { useRooms } from '../../api';
import { YourProfile } from '../../screens/Profile';
import { useSession } from '../../session';
import { LoadState, PrimaryButton } from '../../components/ui';
import { View } from 'react-native';

export default function YouRoute() {
  const { me } = useSession();
  // Fetch active hosted summaries without downloading the campus-wide feed.
  const { rooms, loading, error, reload, hasMore, loadMore, refreshing } = useRooms({ scope: 'host', hostId: me?.id });
  if (!me) return null;
  return <View style={{ flex: 1 }}><LoadState loading={loading} error={error} retry={reload} />
    <YourProfile key={me.id} me={me} rooms={rooms}
      pagination={hasMore ? <PrimaryButton label="Load more rooms" disabled={refreshing} onPress={loadMore} /> : null} /></View>;
}
