import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View, useColorScheme } from 'react-native';
import { CreateStep1, CreateStep2 } from './screens/Create';
import { Discover, DiscoverEmpty, DiscoverFreshman } from './screens/Discover';
import { OnboardingProfile, OnboardingSignIn } from './screens/Onboarding';
import { Profile, ProfileEmpty } from './screens/Profile';
import { ReportSheet } from './screens/Report';
import {
  Room,
  RoomCanceled,
  RoomCasualPreJoin,
  RoomHost,
  RoomHostRequests,
} from './screens/Room';
import { ThemeContext, dark, font, light, radius, type Scheme } from './theme';

/** Every screen the design file renders, in its order. */
const screens = [
  ['Discover', Discover],
  ['Room', Room],
  ['Profile', Profile],
  ['Create 1', CreateStep1],
  ['Create 2', CreateStep2],
  ['Sign in', OnboardingSignIn],
  ['Onboard', OnboardingProfile],
  ['Room · host', RoomHost],
  ['Report', ReportSheet],
  ['Discover · empty', DiscoverEmpty],
  ['Profile · fresh', ProfileEmpty],
  ['Room · casual', RoomCasualPreJoin],
  ['Room · requests', RoomHostRequests],
  ["Discover · '29", DiscoverFreshman],
  ['Room · canceled', RoomCanceled],
] as const;

/**
 * Screen picker. The design has no navigation — this is the harness that lets
 * the 15 mocks be viewed on a device.
 * ponytail: delete once real navigation exists.
 */
const Picker = ({
  index,
  setIndex,
  scheme,
  setScheme,
}: {
  index: number;
  setIndex: (i: number) => void;
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
}) => {
  const c = scheme === 'dark' ? dark : light;
  const step = (by: number) => setIndex((index + by + screens.length) % screens.length);
  const btn = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      <Text style={{ fontFamily: font.medium, fontSize: 15, color: c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ position: 'absolute', right: 12, bottom: 90 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: radius.round,
          backgroundColor: c.surface94,
          borderWidth: 1,
          borderColor: c.frame,
        }}>
        {btn('‹', () => step(-1))}
        <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.mute }}>
          {screens[index][0]}
        </Text>
        {btn('›', () => step(1))}
        {btn(scheme === 'dark' ? '☀' : '☾', () => setScheme(scheme === 'dark' ? 'light' : 'dark'))}
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  const [loaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const system = useColorScheme();
  const [index, setIndex] = useState(0);
  const [scheme, setScheme] = useState<Scheme>(system === 'dark' ? 'dark' : 'light');

  if (!loaded) return null;

  const c = scheme === 'dark' ? dark : light;
  const Screen = screens[index][1];
  return (
    <ThemeContext.Provider value={{ c, scheme }}>
      <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
        <Screen />
        <Picker index={index} setIndex={setIndex} scheme={scheme} setScheme={setScheme} />
      </View>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeContext.Provider>
  );
}
