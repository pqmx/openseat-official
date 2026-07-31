import { useLocalSearchParams } from 'expo-router';
import { personById, you } from '../../../data';
import { Profile } from '../../../screens/Profile';

export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Profile person={personById(id) ?? you} />;
}
