import * as Apple from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, useColorScheme, View } from 'react-native';
import { saveProfile } from '../api';
import { Body, StatusStrip } from '../components/layout';
import { Eyebrow } from '../components/ui';
import { Field, PrimaryButton, YearChip } from '../components/controls';
import { classYears } from '../data';
import { Refusal, useSession } from '../session';
import { font, radius, type, useTheme } from '../theme';
import { safeRoomDestination } from '../room-rules';
import { errorMessage } from '../errors';

const Problem = ({ message }: { message: string }) => {
  const { c } = useTheme();
  return (
    <Text
      style={{
        fontFamily: font.regular,
        fontSize: 13,
        lineHeight: 13 * 1.5,
        color: c.coral,
      }}>
      {message}
    </Text>
  );
};

/** Provider sign-in. Campus-email enforcement lives on the server. */
export function SignIn() {
  const { c } = useTheme();
  const dark = useColorScheme() === 'dark';
  const { signInWithGoogle, signInWithApple } = useSession();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [failed, setFailed] = useState<string>();
  // Apple's own availability check rather than `Platform.OS`: it's false on
  // Android, on the simulator without an Apple ID, and on old iOS.
  const [hasApple, setHasApple] = useState(false);
  useEffect(() => {
    // Device support alone is insufficient: the provider must be configured in Supabase.
    if (process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED !== 'true') return;
    Apple.isAvailableAsync().then(setHasApple, () => setHasApple(false));
  }, []);

  const go = (run: () => Promise<void>) => async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(undefined);
    try {
      await run();
      // No navigation: the session lands, the gate re-renders as `/onboarding`
      // or `/discover`. Pushing from here would race that.
    } catch (e) {
      // Only a `Refusal` was written to be read. A provider's own error names
      // tokens and client IDs, which tells the student nothing and us less.
      setFailed(e instanceof Refusal ? e.message : 'Sign-in failed. Try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body
        contentStyle={{
          paddingHorizontal: 22,
          paddingBottom: 24,
          gap: 16,
          flexGrow: 1,
          justifyContent: 'flex-end',
        }}>
        <Text style={[type.display, { color: c.ink }]}>
          Somewhere to be,{'\n'}in the next hour.
        </Text>
        <Text
          style={{
            fontFamily: font.regular,
            fontSize: 14,
            lineHeight: 14 * 1.55,
            color: c.mute,
          }}>
          Rooms open across Westwood all night. Use your UCLA account to see the ones near you.
        </Text>

        {failed ? <Problem message={failed} /> : null}

        <View style={{ marginTop: 8, gap: 12 }}>
          <PrimaryButton
            label={busy ? 'One moment…' : 'Continue with Google'}
            disabled={busy}
            onPress={go(signInWithGoogle)}
          />
          {hasApple ? (
            // Apple's own button, because their guidelines require it and
            // because a hand-drawn one is the sort of thing review rejects.
            <Apple.AppleAuthenticationButton
              buttonType={Apple.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                dark
                  ? Apple.AppleAuthenticationButtonStyle.WHITE
                  : Apple.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radius.md}
              style={{ height: 46 }}
              onPress={go(signInWithApple)}
            />
          ) : null}
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 12,
              lineHeight: 12 * 1.5,
              color: c.faint,
              textAlign: 'center',
            }}>
            UCLA accounts only — @ucla.edu or @g.ucla.edu.
            {hasApple ? ' Signing in with Apple requires one of those addresses, with Hide My Email off.' : ''}
          </Text>
        </View>
      </Body>
    </View>
  );
}

/** Collect the required class year and optional major. */
export function Onboarding() {
  const { c } = useTheme();
  const { me, reloadMe } = useSession();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const lock = useRef(false);
  const [year, setYear] = useState<string>();
  const [major, setMajor] = useState('');
  const [focus, setFocus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();

  if (!me) return null;

  const save = async () => {
    if (!year || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(undefined);
    try {
      await saveProfile(me.id, { year, major });
      await reloadMe();
      router.replace(safeRoomDestination(next) as '/discover');
    } catch (error) {
      setFailed(errorMessage(error));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };

  const input = {
    fontFamily: font.regular,
    fontSize: 15,
    color: c.ink,
    padding: 0,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 24, flexGrow: 1 }}>
        <View>
          <Text style={[type.display, { color: c.ink }]}>Hey {me.short}.</Text>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 14 * 1.55,
              color: c.mute,
              marginTop: 8,
            }}>
            Your year decides which rooms you can see. The rest is up to you.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <Eyebrow>YOUR YEAR</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {classYears.map((y) => (
              <YearChip key={y} label={y} selected={year === y} onPress={() => setYear(y)} />
            ))}
          </View>
        </View>

        <Field label="MAJOR — OPTIONAL" focused={focus === 'major'}>
          <TextInput
            testID="onboarding-major"
            maxLength={120}
            value={major}
            onChangeText={setMajor}
            onFocus={() => setFocus('major')}
            onBlur={() => setFocus(undefined)}
            placeholder="Architecture"
            placeholderTextColor={c.faint}
            style={input}
          />
        </Field>

        {failed ? <Problem message={failed} /> : null}

        <View style={{ marginTop: 'auto', paddingTop: 20 }}>
          <PrimaryButton
            label={busy ? 'Saving…' : 'Start looking'}
            disabled={!year || busy}
            onPress={save}
          />
        </View>
      </Body>
    </View>
  );
}
