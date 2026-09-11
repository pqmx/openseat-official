import { Pressable, Text, View } from 'react-native';
import type { Tone } from '../data';
import { font, radius, useTheme, type Colors } from '../theme';

const toneOf = (c: Colors, tone: Tone) =>
  tone === 'water'
    ? { backgroundColor: c.water, color: c.avBlue }
    : tone === 'park'
      ? { backgroundColor: c.park, color: c.avGreen }
      : { backgroundColor: c.fill, color: c.ink3 };

export const Avatar = ({
  initials,
  tone = 'fill',
  host,
  size = 40,
  stacked,
}: {
  initials: string;
  tone?: Tone;
  host?: boolean;
  size?: number;
  /** Overlapping row variant: thicker surface-coloured ring, negative offset. */
  stacked?: boolean;
}) => {
  const { c } = useTheme();
  const t = toneOf(c, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.round,
        backgroundColor: t.backgroundColor,
        borderWidth: stacked ? 1.5 : 1,
        borderColor: stacked ? c.surface : c.hair,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontFamily: font.medium,
          fontSize: stacked ? 9.5 : 12.5,
          color: t.color,
        }}>
        {initials}
      </Text>
      {host ? (
        <View
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: radius.round,
            backgroundColor: c.coral,
            borderWidth: 1.5,
            borderColor: c.surface,
          }}
        />
      ) : null}
    </View>
  );
};

/** 48px column: avatar over a name, used in every "who's here" grid. */
export const AvatarCell = ({
  initials,
  name,
  tone,
  host,
  onPress,
}: {
  initials: string;
  name: string;
  tone?: Tone;
  host?: boolean;
  onPress?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={name}
      onPress={onPress}
      style={{ width: 48, alignItems: 'center', gap: 6 }}>
      <Avatar initials={initials} tone={tone} host={host} />
      <Text
        numberOfLines={1}
        style={{ fontFamily: font.regular, fontSize: 10.5, color: c.mute2, maxWidth: 48 }}>
        {name}
      </Text>
    </Pressable>
  );
};

/** Dashed placeholder in the same grid — "+9 more", "open". */
export const SlotCell = ({ badge, label }: { badge?: string; label: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ width: 48, alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.round,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.dash,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {badge ? (
          <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.mute2 }}>{badge}</Text>
        ) : null}
      </View>
      <Text style={{ fontFamily: font.regular, fontSize: 10.5, color: c.faint }}>{label}</Text>
    </View>
  );
};
