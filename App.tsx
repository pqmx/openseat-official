import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ComponentType } from 'react';
import { Pressable, SafeAreaView, Text, View, useColorScheme } from 'react-native';
import { NavContext, type ScreenName } from './nav';
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
const screens: [ScreenName, string, ComponentType][] = [
  ['discover', 'Discover', Discover],
  ['room', 'Room', Room],
  ['profile', 'Profile', Profile],
  ['create1', 'Create 1', CreateStep1],
  ['create2', 'Create 2', CreateStep2],
  ['signIn', 'Sign in', OnboardingSignIn],
  ['onboard', 'Onboard', OnboardingProfile],
  ['roomHost', 'Room · host', RoomHost],
  ['report', 'Report', ReportSheet],
  ['discoverEmpty', 'Discover · empty', DiscoverEmpty],
  ['profileEmpty', 'Profile · fresh', ProfileEmpty],
  ['roomCasual', 'Room · casual', RoomCasualPreJoin],
  ['roomHostRequests', 'Room · requests', RoomHostRequests],
  ['discoverFreshman', "Discover · '29", DiscoverFreshman],
  ['roomCanceled', 'Room · canceled', RoomCanceled],
];

/**
 * Screen picker. Buttons navigate for real now, but four states — the empty
 * and '29 Discovers, the casual pre-join room, the canceled room — have no
 * path to them, so the picker stays as the way in.
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
          {screens[index][1]}
        </Text>
        {btn('›', () => step(1))}
        {btn(scheme === 'dark' ? '☀' : '☾', () => setScheme(scheme === 'dark' ? 'light' : 'dark'))}
      </View>
    </SafeAreaView>
  );
};

const indexOf = (name: ScreenName) => screens.findIndex((s) => s[0] === name);

export default function App() {
  const [loaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const system = useColorScheme();
  const [stack, setStack] = useState([0]);
  const [scheme, setScheme] = useState<Scheme>(system === 'dark' ? 'dark' : 'light');

  const nav = useMemo(
    () => ({
      go: (name: ScreenName) => setStack((s) => [...s, indexOf(name)]),
      reset: (name: ScreenName) => setStack([indexOf(name)]),
      // Deep-linked straight into a screen? Back still has somewhere to go.
      back: () =>
        setStack((s) => (s.length > 1 ? s.slice(0, -1) : [indexOf('discover')])),
    }),
    []
  );

  if (!loaded) return null;

  const c = scheme === 'dark' ? dark : light;
  const index = stack[stack.length - 1];
  const Screen = screens[index][2];
  return (
    <ThemeContext.Provider value={{ c, scheme }}>
      <NavContext.Provider value={nav}>
        <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
          <Screen />
          <Picker
            index={index}
            setIndex={(i) => setStack([i])}
            scheme={scheme}
            setScheme={setScheme}
          />
        </View>
      </NavContext.Provider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeContext.Provider>
  );
}
