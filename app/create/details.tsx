import { useLocalSearchParams } from 'expo-router';
import { CreateStep2 } from '../../screens/CreateSettings';
import { NotFound } from '../../screens/NotFound';
import { useSession } from '../../session';

/** Step 1 hands the draft's first half over in the URL. */
export default function CreateDetailsRoute() {
  // Params come back as strings however they went out, so the pin has to be
  // parsed — `Number(undefined)` is NaN, hence the guard.
  const { title, place, lat, lng } = useLocalSearchParams<{
    title?: string;
    place?: string;
    lat?: string;
    lng?: string;
  }>();
  // Your year isn't in the URL and shouldn't be — it's who you are, not what
  // you typed. The screen needs it so "class years only" can't lock you out of
  // your own room.
  const { me } = useSession();

  const latitude = Number(lat);
  const longitude = Number(lng);
  // Step 1 gates Next on a picked place, so anything missing here is a
  // malformed URL. Defaulting one used to open the room at campus centre under
  // a mock title — a dead link says so instead.
  if (!title || !place || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return <NotFound />;
  }

  return (
    <CreateStep2
      title={title}
      place={place}
      lat={latitude}
      lng={longitude}
      myYear={me?.year}
    />
  );
}
