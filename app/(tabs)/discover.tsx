import { Discover } from '../../screens/Discover';
import { useSession } from '../../session';

/** Discover carries the map and the sheet — the most that can go wrong. */
export { RouteError as ErrorBoundary } from '../../screens/NotFound';

export default function DiscoverRoute() {
  const { me } = useSession();
  if (!me) return null;
  return <Discover />;
}
