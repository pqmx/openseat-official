import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeContext, dark, font, light, radius, type, type Scheme } from '../theme';

/**
 * Expo Router renders this for any route that throws. Same tokens as the rest
 * of the app, but it can't use `useTheme` — the provider is what just failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = light;
  return (
    <View
      style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 14 }}>
      <Text style={[type.display, { color: c.ink }]}>That screen broke.</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>{error.message}</Text>
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

export default function RootLayout() {
  const [loaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  // The design has a light and a dark set; the OS setting picks between them.
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = scheme === 'dark' ? dark : light;
  const value = useMemo(() => ({ c }), [c]);

  if (!loaded) return null;

  return (
    // Discover's sheet is dragged with gesture-handler, which needs a root of
    // its own on Android. Expo Router only supplies one inside its JS stack,
    // and this app is on the native one.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={value}>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bgCanvas } }}>
          {/* Report is the app's one sheet — the ⋯ menu on a room or a profile. */}
          <Stack.Screen name="report" options={{ presentation: 'formSheet', sheetGrabberVisible: true }} />
        </Stack>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  );
}
