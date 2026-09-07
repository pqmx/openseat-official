import * as Sentry from '@sentry/react-native';
import { Link, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { font, radius, type, useTheme } from '../theme';

/** Fallback for unmatched routes and unavailable rooms. */
export function NotFound() {
  const { c } = useTheme();
  return (
    <View
      style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 12 }}>
      <Text style={[type.display, { color: c.ink }]}>No room at that address.</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
        The link may be old, or the host closed it.
      </Text>
      {/* Replace the dead route so Back cannot return to it. */}
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

/** Route error boundary rendered inside the theme provider. */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const { c } = useTheme();
  // Inner boundaries report their own errors, once per error object.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <View
      style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 12 }}>
      <Text style={[type.display, { color: c.ink }]}>That didn&rsquo;t load.</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
        Something went wrong on our end. It has been reported.
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
