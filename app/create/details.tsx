import { useLocalSearchParams } from 'expo-router';
import { CreateStep2 } from '../../screens/Create';

/** Step 1 hands the draft's first half over in the URL. */
export default function CreateDetailsRoute() {
  const { title, place } = useLocalSearchParams<{ title?: string; place?: string }>();
  return <CreateStep2 title={title} place={place} />;
}
