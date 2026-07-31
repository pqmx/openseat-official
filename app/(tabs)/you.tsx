import { ProfileEmpty } from '../../screens/Profile';
import { useSession } from '../../session';

export default function YouRoute() {
  const { me } = useSession();
  if (!me) return null;
  return <ProfileEmpty me={me} />;
}
