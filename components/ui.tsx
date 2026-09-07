import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { Tone } from '../data';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, type, useTheme, type Colors } from '../theme';
import { ClockIcon, FilterIcon, HomeIcon, PersonIcon, PlusIcon } from './icons';

/** Reserve the device’s top safe-area inset. */
export const StatusStrip = () => {
  const { top } = useSafeAreaInsets();
  return <View style={{ height: top }} />;
};

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

export const PrimaryButton = ({
  label,
  height = 46,
  danger,
  disabled,
  style,
  onPress,
  children,
}: {
  label: string;
  height?: number;
  danger?: boolean;
  /** A full room still says so — it just stops offering the tap. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  children?: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          height,
          borderRadius: radius.md,
          backgroundColor: disabled ? c.disabled : danger ? c.danger : c.coral,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 11,
        },
        style,
      ]}>
      {children}
      <Text
        style={{
          fontFamily: font.medium,
          fontSize: height >= 46 ? 15 : 14,
          color: danger ? c.onDanger : c.onCoral,
        }}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Bare text control — "Cancel", "Leave room", "Decline", "Directions". */
export const TextButton = ({
  label,
  style,
  onPress,
}: {
  label: string;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
}) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
    <Text style={style}>{label}</Text>
  </Pressable>
);

/** Bordered tag: interests, "Now"/"+1 hr", "Share"/"End room". */
export const Chip = ({
  label,
  selected,
  dashed,
  color,
  style,
  onPress,
}: {
  label: string;
  selected?: boolean;
  dashed?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        {
          paddingVertical: 5,
          paddingHorizontal: 11,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: selected ? c.ink : c.hair2,
        },
        dashed ? { borderStyle: 'dashed', borderColor: c.dash } : null,
        style,
      ]}>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: 12.5,
          color: color ?? (selected ? c.ink : c.ink2),
        }}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Equal-width segment: class-year pickers. Filled when selected. */
export const YearChip = ({
  label,
  selected,
  size = 13,
  paddingVertical = 9,
  onPress,
}: {
  label: string;
  selected?: boolean;
  size?: number;
  paddingVertical?: number;
  onPress?: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        { flex: 1, alignItems: 'center', paddingVertical, borderRadius: radius.chip },
        selected
          ? { backgroundColor: c.ink }
          : { borderWidth: 1, borderColor: c.hair2 },
      ]}>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: size,
          color: selected ? c.surface : c.mute,
        }}>
        {label}
      </Text>
    </Pressable>
  );
};

export const Toggle = ({ on, onPress }: { on: boolean; onPress?: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'switch' : undefined}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[
        {
          width: 42,
          height: 24,
          borderRadius: radius.round,
          padding: 2,
          flexDirection: 'row',
          alignItems: 'center',
        },
        on
          ? { backgroundColor: c.green, justifyContent: 'flex-end' }
          : { borderWidth: 1, borderColor: c.dash },
      ]}>
      <View
        style={[
          { width: 20, height: 20, borderRadius: radius.round, backgroundColor: c.surface },
          on ? null : { borderWidth: 1, borderColor: c.hair2 },
        ]}
      />
    </Pressable>
  );
};

export const Radio = ({ on }: { on: boolean }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 17,
        height: 17,
        borderRadius: radius.round,
        borderWidth: 1.5,
        borderColor: on ? c.ink : c.dash,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {on ? (
        <View
          style={{ width: 8, height: 8, borderRadius: radius.round, backgroundColor: c.ink }}
        />
      ) : null}
    </View>
  );
};

/** Labeled input with an underline showing focus. */
export const Field = ({
  label,
  focused,
  paddingBottom = 10,
  children,
}: {
  label: string;
  focused?: boolean;
  paddingBottom?: number;
  children: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <View
        style={{
          paddingBottom,
          borderBottomWidth: focused ? 1.5 : 1,
          borderBottomColor: focused ? c.ink : c.hair2,
        }}>
        {children}
      </View>
    </View>
  );
};

/** Floating filter button over the map. */
export const MapFilterButton = ({
  filtersOn,
  onFilters,
}: {
  /** Dot on the button when the feed is narrowed. */
  filtersOn?: boolean;
  onFilters: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Filters"
      accessibilityState={{ expanded: !!filtersOn }}
      onPress={onFilters}
      style={{
        position: 'absolute',
        top: 60,
        right: 20,
        width: 42,
        height: 42,
        borderRadius: radius.md,
        backgroundColor: c.surface94,
        borderWidth: 1,
        borderColor: filtersOn ? c.ink : c.frame,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <FilterIcon color={c.ink2} />
      {filtersOn ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: radius.round,
            backgroundColor: c.coral,
          }}
        />
      ) : null}
    </Pressable>
  );
};

/** App tabs; the active slot follows the current route. */
export const TabBar = () => {
  const { c } = useTheme();
  const path = usePathname();
  const active = path.startsWith('/rooms') ? 'rooms' : path.startsWith('/discover') ? 'discover' : 'you';
  const slot = (
    label: string,
    selected: boolean,
    icon: React.ReactNode,
    onPress: () => void
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', gap: 5 }}>
      <View style={{ height: 28, justifyContent: 'center' }}>{icon}</View>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: 10,
          color: selected ? c.ink : c.faint,
        }}>
        {label}
      </Text>
    </Pressable>
  );
  const tint = (t: string) => (t === active ? c.ink : c.faint);
  return (
    <View
      style={{
        height: 78,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.hair,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 16,
      }}>
      {slot('Discover', active === 'discover', <HomeIcon color={tint('discover')} />, () =>
        router.navigate('/discover')
      )}
      {slot('Rooms', active === 'rooms', <ClockIcon color={tint('rooms')} />, () =>
        router.navigate('/rooms')
      )}
      {slot(
        'New',
        false,
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.chip,
            backgroundColor: c.coral,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <PlusIcon size={16} color={c.onCoral} />
        </View>,
        () => router.push('/create')
      )}
      {slot('You', active === 'you', <PersonIcon color={tint('you')} />, () =>
        router.navigate('/you')
      )}
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

/** The bar under the fold: a hairline rule, then the screen's actions. */
export const Footer = ({
  children,
  raised,
  gap = 14,
  column,
}: {
  children: React.ReactNode;
  raised?: boolean;
  gap?: number;
  column?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        paddingTop: 14,
        paddingHorizontal: 22,
        paddingBottom: 28,
        borderTopWidth: 1,
        borderTopColor: c.hair,
        backgroundColor: raised ? c.raised : c.surface,
        flexDirection: column ? 'column' : 'row',
        alignItems: column ? 'stretch' : 'center',
        gap,
      }}>
      {children}
    </View>
  );
};

/** Body region of a screen — scrolls where the mock simply clipped. */
export const Body = ({
  children,
  style,
  contentStyle,
  keyboardAware,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Allow taps on results while the keyboard is open. */
  keyboardAware?: boolean;
}) => (
  <ScrollView
    style={[{ flex: 1 }, style]}
    contentContainerStyle={contentStyle}
    // Scrolling away from a field closes the keyboard, which blurs it. That is
    // load-bearing on `/you`: a prompt saves on blur, so without this you could
    // type an answer, scroll, background the app and lose it.
    keyboardDismissMode="on-drag"
    keyboardShouldPersistTaps={keyboardAware ? 'handled' : undefined}
    // iOS only. Android resizes already, from Expo's default layout mode.
    automaticallyAdjustKeyboardInsets={keyboardAware}
    showsVerticalScrollIndicator={false}>
    {children}
  </ScrollView>
);
