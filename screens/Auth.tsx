import * as Apple from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput, useColorScheme, View } from 'react-native';
import { saveProfile } from '../api';
import { Body, Eyebrow, Field, PrimaryButton, StatusStrip, YearChip } from '../components/ui';
import { classYears } from '../data';
import { useSession } from '../session';
import { font, radius, type, useTheme } from '../theme';

/**
 * The gate and the two fields behind it. Both assume the credential carries a
 * name and an email and nothing else — which is all Google and Apple give back.
 */

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

/**
 * The gate: two buttons, no password.
 *
 * Neither provider is asked to prove the address is a UCLA one — Google can't
 * be told about two hosted domains at once, and Apple can't be told at all.
 * `handle_new_user()` raises on any other domain and the message it raises is
 * what lands in `failed`, so there is one copy of that rule and it's the one
 * that can actually refuse. The Apple path checks the token's email before
 * sending it purely so the refusal names the address; see `session.tsx`.
 */
export function SignIn() {
  const { c } = useTheme();
  const dark = useColorScheme() === 'dark';
  const { signInWithGoogle, signInWithApple } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();
  // Apple's own availability check rather than `Platform.OS`: it's false on
  // Android, on the simulator without an Apple ID, and on old iOS.
  const [hasApple, setHasApple] = useState(false);
  useEffect(() => {
    Apple.isAvailableAsync().then(setHasApple, () => setHasApple(false));
  }, []);

  const go = (run: () => Promise<void>) => async () => {
    setBusy(true);
    setFailed(undefined);
    try {
      await run();
      // No navigation: the session lands, the gate re-renders as `/onboarding`
      // or `/discover`. Pushing from here would race that.
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
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
            UCLA accounts only — @ucla.edu or @g.ucla.edu. Signing in with Apple works only if
            your Apple ID is one of those, with Hide My Email off.
          </Text>
        </View>
      </Body>
    </View>
  );
}

/**
 * Everything Google doesn't return. Year is required and the rest isn't:
 * the feed is year-gated in the database, so an account without one would sign
 * in successfully and then find an almost empty map.
 */
export function Onboarding() {
  const { c } = useTheme();
  const { me, reloadMe } = useSession();
  const [year, setYear] = useState<string>();
  const [major, setMajor] = useState('');
  const [focus, setFocus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();

  if (!me) return null;

  const save = async () => {
    if (!year) return;
    setBusy(true);
    setFailed(undefined);
    try {
      await saveProfile(me.id, { year, major });
      await reloadMe();
      router.replace('/discover');
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not save your profile.');
      setBusy(false);
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
