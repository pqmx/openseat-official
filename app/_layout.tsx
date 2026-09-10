import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { useFonts } from 'expo-font';
import * as Sentry from '@sentry/react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../session';
import { ConnectionBanner, ConnectionProvider } from '../connectivity';
import { ThemeContext, dark, font, light, radius, type, type Scheme } from '../theme';

/** Optional production crash reporting without tracing or default PII collection. */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // The DSN is inlined into the bundle like every EXPO_PUBLIC_ value, which is
    // what a DSN is for — it accepts events and reads nothing back.
    enabled: !__DEV__,
  });
}

/** Root fallback cannot depend on the theme provider being mounted. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = light;
  // Keyed on the error itself: `retry` re-renders this with the same object if
  // the route throws again, and reporting per render would send a crash loop.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <View
      style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 14 }}>
      <Text style={[type.display, { color: c.ink }]}>That screen broke.</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
        Something went wrong. Please try again.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={retry}
        style={{
          alignSelf: 'flex-start',
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

function RootLayout() {
  const [loaded, fontError] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  // The design has a light and a dark set; the OS setting picks between them.
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = scheme === 'dark' ? dark : light;
  const value = useMemo(() => ({ c }), [c]);

  if (fontError) throw fontError;
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center' }}>
    <ActivityIndicator accessibilityLabel="Loading Openseat" color={c.coral} />
  </View>;

  return (
    // Discover's sheet is dragged with gesture-handler, which needs a root of
    // its own on Android. Expo Router only supplies one inside its JS stack,
    // and this app is on the native one.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* StatusStrip reads the real inset from this — a Dynamic Island isn't
          the same height on every phone, so a fixed guess under-covers some. */}
      <SafeAreaProvider>
        <ThemeContext.Provider value={value}>
          <ConnectionProvider>
            <ConnectionBanner />
            {/* Identity is ambient, like the theme — every screen reads it. */}
            <SessionProvider>
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bgCanvas } }}>
                {/* Report is the app's one sheet — the ⋯ menu on a room or a profile. */}
                <Stack.Screen name="report" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
              </Stack>
            </SessionProvider>
          </ConnectionProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Catches what the router's ErrorBoundary can't: a throw above it, and the
// native crashes no JS handler ever sees.
export default Sentry.wrap(RootLayout);
