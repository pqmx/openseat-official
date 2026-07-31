import { Text, View } from 'react-native';
import { BackIcon, ChevronDownIcon } from '../components/icons';
import {
  Body,
  Dot,
  Eyebrow,
  Field,
  ImageSlot,
  PrimaryButton,
  StatusStrip,
  YearChip,
} from '../components/ui';
import { em, font, radius, type, useTheme } from '../theme';

/** Two 22px rules; the second fills on step 2. */
const Progress = ({ step }: { step: 1 | 2 }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      <View style={{ width: 22, height: 2, backgroundColor: c.ink }} />
      <View style={{ width: 22, height: 2, backgroundColor: step === 2 ? c.ink : c.hair2 }} />
    </View>
  );
};

/** Onboarding step 1 — Google sign-in doubles as UCLA verification. */
export function OnboardingSignIn() {
  const { c } = useTheme();
  const bullet = (color: string, text: string) => (
    <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <Dot color={color} />
      <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.ink2 }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingTop: 24, paddingHorizontal: 22, gap: 30 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 19,
              letterSpacing: em(-0.022, 19),
              color: c.ink,
            }}>
            openseat
          </Text>
          <Progress step={1} />
        </View>

        <View>
          <Text style={[type.display, { lineHeight: 26 * 1.2, color: c.ink }]}>
            Who's in?{'\n'}Rooms are UCLA-only.
          </Text>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 14 * 1.55,
              color: c.mute,
              marginTop: 12,
              maxWidth: 302,
            }}>
            Sign in with your UCLA Google account. That's the whole verification — no code to wait
            for, and your email never shows on your profile.
          </Text>
        </View>

        <View style={{ gap: 14, paddingTop: 22, borderTopWidth: 1, borderTopColor: c.hair }}>
          {bullet(c.green, 'Only @ucla.edu and @g.ucla.edu accounts')}
          {bullet(c.blue, 'Rooms and pins stay inside the school')}
          {bullet(c.dotMute, 'We never post anything to your account')}
        </View>
      </Body>

      <View style={{ paddingTop: 14, paddingHorizontal: 22, paddingBottom: 28, gap: 16 }}>
        <PrimaryButton label="Continue with Google" height={50}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.round,
              backgroundColor: c.onCoral,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: c.coral }}>G</Text>
          </View>
        </PrimaryButton>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
            Not a Bruin?
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.blue }}>
            See what openseat is
          </Text>
        </View>
        <Text
          style={{
            fontFamily: font.regular,
            fontSize: 11.5,
            lineHeight: 11.5 * 1.5,
            color: c.faint,
            textAlign: 'center',
          }}>
          By continuing you agree to the community rules.{'\n'}Rooms are visible to verified students
          only.
        </Text>
      </View>
    </View>
  );
}

/** Onboarding step 2 — the four things a profile needs to exist. */
export function OnboardingProfile() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingTop: 24, paddingHorizontal: 22, gap: 26 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackIcon color={c.ink} />
          <Progress step={2} />
        </View>

        <View>
          <Text style={[type.display, { lineHeight: 26 * 1.2, color: c.ink }]}>
            Verified. Now, who are you?
          </Text>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 14 * 1.55,
              color: c.mute,
              marginTop: 10,
            }}>
            Four quick things. Prompts can wait.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ImageSlot size={76} placeholder="Photo" />
          <View>
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: c.blue }}>
              Add a photo
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
              Helps people spot you in a room
            </Text>
          </View>
        </View>

        <Field label="NAME" focused>
          <Text style={{ fontFamily: font.regular, fontSize: 17, color: c.ink }}>Maya Jiménez</Text>
        </Field>

        <View style={{ gap: 10 }}>
          <Eyebrow>CLASS YEAR</Eyebrow>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            <YearChip label="'27" size={13.5} paddingVertical={10} />
            <YearChip label="'28" size={13.5} paddingVertical={10} selected />
            <YearChip label="'29" size={13.5} paddingVertical={10} />
            <YearChip label="Grad" size={13.5} paddingVertical={10} />
          </View>
        </View>

        <Field label="MAJOR">
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: font.regular, fontSize: 17, color: c.ink }}>
              Architecture
            </Text>
            <ChevronDownIcon color={c.mute2} />
          </View>
        </Field>
      </Body>

      <View style={{ paddingTop: 14, paddingHorizontal: 22, paddingBottom: 28, gap: 12 }}>
        <PrimaryButton label="Enter openseat" />
        <Text
          style={{
            fontFamily: font.regular,
            fontSize: 12.5,
            color: c.faint,
            textAlign: 'center',
          }}>
          You can add prompts and interests later
        </Text>
      </View>
    </View>
  );
}
