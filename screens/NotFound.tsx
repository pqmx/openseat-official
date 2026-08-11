import { Link, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { font, radius, type, useTheme } from '../theme';

/**
 * Two routes end up here: an address that matches no route at all, and
 * `/room/[id]` for an id that isn't a room. Same sentence covers both, and
 * `roomById` returning undefined is what makes the second one reachable —
 * it used to render whichever room happened to be first.
 */
export function NotFound() {
  const { c } = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 12 }}>
      <Text style={[type.display, { color: c.ink }]}>No room at that address.</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
        The link may be old, or the host closed it.
      </Text>
      {/*
        `replace`, not a plain link. A bare `href` navigates, which leaves the
        dead route on the stack — so "Back to Discover" got you to Discover and
        the very next back gesture put you straight back on this screen, with
        nothing behind it but the address that already didn't resolve.

        Same trap `Create` documents: the screen you are leaving is spent, so it
        has to be swapped rather than stacked on top of. `RoomCanceled` and
        leaving a room both `router.replace('/discover')` for this reason.
      */}
      <Link
        href="/discover"
        replace
        accessibilityRole="link"
        style={{ fontFamily: font.medium, fontSize: 14, color: c.coral, marginTop: 4 }}>
        Back to Discover
      </Link>
    </View>
  );
}

/**
 * A route that threw. Exported as `ErrorBoundary` from the routes worth
 * isolating, so one broken screen doesn't take the whole app down with it —
 * the tab bar survives and you can walk away from the wreck. The root boundary
 * in `app/_layout.tsx` stays the backstop for everything else, and it can't use
 * the theme because the provider is what failed; here it's still above us.
 */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 12 }}>
      <Text style={[type.display, { color: c.ink }]}>That didn&rsquo;t load.</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
        {error.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={retry}
        style={{
          alignSelf: 'flex-start',
          marginTop: 4,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: radius.chip,
          backgroundColor: c.coral,
        }}>
        <Text style={{ fontFamily: font.medium, fontSize: 14, color: c.onCoral }}>Try again</Text>
      </Pressable>
    </View>
  );
}
