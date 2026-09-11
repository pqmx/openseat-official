import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated';
import { Text, View } from 'react-native';
import { font, radius, type, useTheme } from '../theme';

export const Eyebrow = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return <Text style={[type.eyebrow, { color: c.mute2 }]}>{children}</Text>;
};

export const Dot = ({
  color,
  size = 6,
  glow,
  glowWidth = 5,
  outline,
}: {
  color: string;
  size?: number;
  glow?: string;
  glowWidth?: number;
  outline?: boolean;
}) => {
  const dot = (
    <View
      style={[
        { width: size, height: size, borderRadius: radius.round },
        outline ? { borderWidth: 1, borderColor: color } : { backgroundColor: color },
      ]}
    />
  );
  // CSS uses a spread-only `box-shadow: 0 0 0 5px`; RN has no spread, so the
  // ring is a padded wrapper. Callers offset by `glowWidth` when positioning.
  return glow ? (
    <View style={{ padding: glowWidth, borderRadius: radius.round, backgroundColor: glow }}>
      {dot}
    </View>
  ) : (
    dot
  );
};

/** `@keyframes osPulse` — 2.4s, opacity 1 -> .3 -> 1. */
const PulseDot = ({ color, size = 6 }: { color: string; size?: number }) => {
  const opacity = useSharedValue(1);
  useEffect(() => {
    const leg = (toValue: number) =>
      withTiming(toValue, { duration: 1200, easing: Easing.inOut(Easing.ease) });
    opacity.value = withRepeat(withSequence(leg(0.3), leg(1)), -1);
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: radius.round, backgroundColor: color },
        style,
      ]}
    />
  );
};

/** "● LIVE · 22M" / "● SAT 2 PM" — the status line above every title. */
export const StatusLine = ({
  label,
  color,
  pulse,
  small,
  outline,
}: {
  label: string;
  color: string;
  pulse?: boolean;
  small?: boolean;
  outline?: boolean;
}) => {
  const size = small ? 5 : 6;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      {pulse ? (
        <PulseDot color={color} size={size} />
      ) : (
        <Dot color={color} size={size} outline={outline} />
      )}
      <Text style={[type.eyebrow, { fontSize: small ? 9.5 : 10, color }]}>{label}</Text>
    </View>
  );
};

/** Host-update / last-note item: a coloured left rule with text beside it. */
export const NoteItem = ({
  text,
  meta,
  accent,
  muted,
}: {
  text: string;
  meta: string;
  accent?: string;
  muted?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingLeft: 14, borderLeftWidth: 1.5, borderLeftColor: accent ?? c.hair }}>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: muted ? 14 : 14.5,
          lineHeight: (muted ? 14 : 14.5) * 1.5,
          color: muted ? c.ink3 : c.ink,
        }}>
        {text}
      </Text>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: 11.5,
          color: muted ? c.faint : c.mute2,
          marginTop: 6,
        }}>
        {meta}
      </Text>
    </View>
  );
};
