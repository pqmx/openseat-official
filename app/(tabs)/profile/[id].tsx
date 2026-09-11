import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { fetchPerson, useRooms } from '../../../api';
import { useRoomResource } from '../../../room-resource';
import { LoadState } from '../../../components/layout';
import { PrimaryButton } from '../../../components/controls';
import { NotFound } from '../../../screens/NotFound';
import { Profile } from '../../../screens/Profile';

export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetchProfile = useCallback(async () => (await fetchPerson(id)) ?? null, [id]);
  const profile = useRoomResource('profile:' + id, fetchProfile);
  const { rooms, loading, error, reload, hasMore, refreshing, loadMore } = useRooms({ scope: 'host', hostId: id });
  if (profile.data === null) return <NotFound />;
  return <View style={{ flex: 1 }}>
    <LoadState loading={profile.loading || loading} error={profile.error ?? error}
      retry={() => { void profile.reload(); void reload(); }} />
    {profile.data ? <Profile key={id} person={profile.data} rooms={rooms}
      pagination={hasMore ? <PrimaryButton label="Load more rooms" disabled={refreshing} onPress={loadMore} /> : null} /> : null}
  </View>;
}
