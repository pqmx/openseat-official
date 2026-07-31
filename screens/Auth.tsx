import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { saveProfile } from '../api';
import { Body, Eyebrow, Field, PrimaryButton, StatusStrip, YearChip } from '../components/ui';
import { classYears } from '../data';
import { useSession } from '../session';
import { font, type, useTheme } from '../theme';

/**
 * The two screens Google can't draw for us. AGENTS.md deleted the hand-drawn
 * sign-in and profile-setup deliberately — Google owns the credential, and the
 * UCLA-specific fields it doesn't return wanted designing against what it
 * actually gives back. It gives back a name and an email, so that is all these
 * assume.
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

/** The gate. One button, because there is exactly one way in. */
export function SignIn() {
  const { c } = useTheme();
  const { signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();

  const go = async () => {
    setBusy(true);
    setFailed(undefined);
    try {
      await signIn();
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
          Rooms open across Westwood all night. Sign in with your UCLA account to see the ones
          near you.
        </Text>

        {failed ? <Problem message={failed} /> : null}

        <View style={{ marginTop: 8, gap: 12 }}>
          <PrimaryButton
            label={busy ? 'Signing in…' : 'Continue with Google'}
            disabled={busy}
            onPress={go}
          />
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 12,
              lineHeight: 12 * 1.5,
              color: c.faint,
              textAlign: 'center',
            }}>
            UCLA accounts only — @ucla.edu or @g.ucla.edu.
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
  const [dorm, setDorm] = useState('');
  const [focus, setFocus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();

  if (!me) return null;

  const save = async () => {
    if (!year) return;
    setBusy(true);
    setFailed(undefined);
    try {
      await saveProfile(me.id, { year, major, dorm });
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

        <Field label="DORM — OPTIONAL" focused={focus === 'dorm'}>
          <TextInput
            value={dorm}
            onChangeText={setDorm}
            onFocus={() => setFocus('dorm')}
            onBlur={() => setFocus(undefined)}
            placeholder="Rieber Hall"
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
