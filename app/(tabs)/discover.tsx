import { useLocalSearchParams } from 'expo-router';
import { Discover } from '../../screens/Discover';

/** Discover carries the map and the sheet — the most that can go wrong. */
export { RouteError as ErrorBoundary } from '../../screens/NotFound';

/**
 * `/discover?year='29` is the freshman feed — same screen, different viewer.
 * The year-gated rooms drop out of `feedFor`, so the map, the list and the
 * count all thin together. Without the param you see it as yourself.
 */
export default function DiscoverRoute() {
  const { year } = useLocalSearchParams<{ year?: string }>();
  return <Discover viewerYear={year} />;
}
