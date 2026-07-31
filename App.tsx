import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ComponentType } from 'react';
import { Pressable, SafeAreaView, Text, View, useColorScheme } from 'react-native';
import { CreateStep1, CreateStep2 } from './screens/Create';
import { Discover } from './screens/Discover';
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
import { Rooms } from './screens/Rooms';
import { NavContext, type Route, type ScreenName } from './nav';
import { ThemeContext, dark, font, light, radius, type Scheme } from './theme';

const screens: Record<ScreenName, ComponentType> = {
  discover: Discover,
  rooms: Rooms,
  room: Room,
  roomHost: RoomHost,
  roomHostRequests: RoomHostRequests,
  roomCasual: RoomCasualPreJoin,
  roomCanceled: RoomCanceled,
  profile: Profile,
  profileEmpty: ProfileEmpty,
  create1: CreateStep1,
  create2: CreateStep2,
  signIn: OnboardingSignIn,
  onboard: OnboardingProfile,
  report: ReportSheet,
};

/**
 * Jump list. Every screen is reachable by tapping through the app; this is
 * for reviewing them without walking the flow, plus the theme switch.
 * ponytail: drop it once the app ships behind a real sign-in.
 */
const jumps: [string, Route][] = [
  ['Sign in', { screen: 'signIn' }],
  ['Onboard', { screen: 'onboard' }],
  ['Discover', { screen: 'discover' }],
  ["Discover · '29", { screen: 'discover' }],
  ['Rooms', { screen: 'rooms' }],
  ['Room', { screen: 'room', roomId: 'sunset' }],
  ['Room · host', { screen: 'roomHost', roomId: 'sunset' }],
  ['Room · requests', { screen: 'roomHostRequests', roomId: 'studio' }],
  ['Room · casual', { screen: 'roomCasual', roomId: 'dinner' }],
  ['Room · canceled', { screen: 'roomCanceled', roomId: 'sunset' }],
  ['Create', { screen: 'create1' }],
  ['Profile', { screen: 'profile', personId: 'mj' }],
  ['Profile · fresh', { screen: 'profileEmpty' }],
  ['Report', { screen: 'report' }],
];

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
  const step = (by: number) => setIndex((index + by + jumps.length) % jumps.length);
  const btn = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      <Text style={{ fontFamily: font.medium, fontSize: 15, color: c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    // Left-aligned: the bottom-right corner is where screens put their real
    // actions ("Leave room", "Report or block").
    <SafeAreaView style={{ position: 'absolute', left: 12, bottom: 96 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: radius.round,
          backgroundColor: c.surface94,
          borderWidth: 1,
          borderColor: c.frame,
        }}>
        {btn('‹', () => step(-1))}
        <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.mute }}>
          {jumps[index][0]}
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
  const [stack, setStack] = useState<Route[]>([{ screen: 'discover' }]);
  const [jump, setJump] = useState(2);
  const [scheme, setScheme] = useState<Scheme>(system === 'dark' ? 'dark' : 'light');

  const nav = useMemo(
    () => ({
      go: (screen: ScreenName, params?: Omit<Route, 'screen'>) =>
        setStack((s) => [...s, { screen, ...params }]),
      reset: (screen: ScreenName, params?: Omit<Route, 'screen'>) =>
        setStack([{ screen, ...params }]),
      // Deep-linked straight into a screen? Back still has somewhere to go.
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ screen: 'discover' }])),
    }),
    []
  );

  if (!loaded) return null;

  const c = scheme === 'dark' ? dark : light;
  const route = stack[stack.length - 1];
  const Screen = screens[route.screen];
  // The one jump that isn't just a route: Discover through a freshman's eyes.
  const freshman = jumps[jump][0].includes("'29") && route.screen === 'discover';
  return (
    <ThemeContext.Provider value={{ c, scheme }}>
      <NavContext.Provider value={{ route, ...nav }}>
        <View style={{ flex: 1, backgroundColor: c.bgCanvas }}>
          {freshman ? <Discover viewerYear="'29" /> : <Screen />}
          <Picker
            index={jump}
            setIndex={(i) => {
              setJump(i);
              setStack([jumps[i][1]]);
            }}
            scheme={scheme}
            setScheme={setScheme}
          />
        </View>
      </NavContext.Provider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeContext.Provider>
  );
}
