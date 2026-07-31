import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useNav } from '../nav';
import { font, radius, type, useTheme, type Colors } from '../theme';
import { ClockIcon, FilterIcon, HomeIcon, PersonIcon, PlusIcon, SearchIcon } from './icons';

/** The design's 50px status-bar strip; the real OS bar draws into it. */
export const StatusStrip = () => <View style={{ height: 50 }} />;

export const Screen = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      {children}
    </View>
  );
};

export const Eyebrow = ({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) => {
  const { c } = useTheme();
  return <Text style={[type.eyebrow, { color: color ?? c.mute2 }, style]}>{children}</Text>;
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
export const PulseDot = ({ color, size = 6 }: { color: string; size?: number }) => {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.3,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: radius.round,
        backgroundColor: color,
        opacity: v,
      }}
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

type AvatarTone = 'fill' | 'water' | 'park';

const toneOf = (c: Colors, tone: AvatarTone) =>
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
  tone?: AvatarTone;
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
  tone?: AvatarTone;
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

/**
 * Stand-in for the design's `<image-slot>` — a user-fillable photo placeholder.
 * The web component's drag-to-fill / sidecar persistence is design-tool
 * plumbing with no app equivalent; this is the empty state it renders.
 * ponytail: wire to expo-image-picker when profile photos actually upload.
 */
export const ImageSlot = ({ size, placeholder }: { size: number; placeholder: string }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.round,
        backgroundColor: c.fill,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.dash,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontFamily: font.regular, fontSize: 10.5, color: c.mute2 }}>
        {placeholder}
      </Text>
    </View>
  );
};

export const Rule = ({ color, style }: { color?: string; style?: StyleProp<ViewStyle> }) => {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: color ?? c.hair }, style]} />;
};

export const PrimaryButton = ({
  label,
  height = 46,
  danger,
  style,
  onPress,
  children,
}: {
  label: string;
  height?: number;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  children?: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        {
          height,
          borderRadius: radius.md,
          backgroundColor: danger ? c.danger : c.coral,
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

/**
 * Eyebrow label over an underlined value — every text input in the design.
 * `focused` is the 1.5px ink rule; unfocused is the 1px hairline.
 */
export const Field = ({
  label,
  focused,
  paddingBottom = 10,
  gap = 8,
  children,
}: {
  label: string;
  focused?: boolean;
  paddingBottom?: number;
  gap?: number;
  children: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ gap }}>
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

/** The coral text caret shown inside "focused" fields. */
export const Caret = ({ height = 15 }: { height?: number }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        width: 1.5,
        height,
        backgroundColor: c.coral,
        marginLeft: 2,
        alignSelf: 'center',
      }}
    />
  );
};

/**
 * Map plate. CSS draws the grid with repeating-linear-gradient; RN has no
 * equivalent, so the bands are Views. Counts are fixed and clipped by
 * `overflow: hidden` — the plate is decorative, not a real map.
 * ponytail: swap the whole plate for react-native-maps when pins go live.
 */
export const MapPlate = ({
  cellW,
  cellH,
  blur,
  style,
  children,
}: {
  cellW: number;
  cellH: number;
  /** Casual pre-join blurs the plate; RN can't blur, so it fades instead. */
  blur?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) => {
  const { c } = useTheme();
  const band = 8;
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: c.hairFaint }, style]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: c.map },
          blur ? { opacity: 0.55 } : null,
        ]}>
        {Array.from({ length: 8 }, (_, i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * cellW + (cellW - band),
              width: band,
              backgroundColor: c.mapGrid,
            }}
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <View
            key={`h${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * cellH + (cellH - band),
              height: band,
              backgroundColor: c.mapGrid,
            }}
          />
        ))}
      </View>
      {children}
    </View>
  );
};

/** Floating "Near campus" search + filter row over the map. */
export const MapSearchBar = () => {
  const { c } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          height: 42,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          backgroundColor: c.surface94,
          borderWidth: 1,
          borderColor: c.frame,
        }}>
        <SearchIcon color={c.mute2} />
        <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
          Near campus
        </Text>
      </View>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: radius.md,
          backgroundColor: c.surface94,
          borderWidth: 1,
          borderColor: c.frame,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <FilterIcon color={c.ink2} />
      </View>
    </View>
  );
};

export type Tab = 'discover' | 'rooms' | 'you';

export const TabBar = ({ active }: { active: Tab }) => {
  const { c } = useTheme();
  const { reset, go } = useNav();
  const tint = (t: Tab) => (t === active ? c.ink : c.faint);
  const tab = (t: Tab, label: string, Icon: typeof HomeIcon, to: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: t === active }}
      onPress={to}
      style={{ alignItems: 'center', gap: 5 }}>
      <Icon color={tint(t)} />
      <Text style={{ fontFamily: font.regular, fontSize: 10, color: tint(t) }}>{label}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        height: 78,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.hair,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 26,
        paddingBottom: 16,
      }}>
      {tab('discover', 'Discover', HomeIcon, () => reset('discover'))}
      {/* No rooms-list screen exists — Rooms opens the room you're in. */}
      {tab('rooms', 'Rooms', ClockIcon, () => reset('room'))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open a room"
        onPress={() => go('create1')}
        style={{
          width: 40,
          height: 40,
          marginBottom: 12,
          borderRadius: radius.card,
          backgroundColor: c.coral,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <PlusIcon color={c.onCoral} />
      </Pressable>
      {tab('you', 'You', PersonIcon, () => reset('profileEmpty'))}
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

/** Body region of a screen — scrolls where the mock simply clipped. */
export const Body = ({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) => (
  <ScrollView
    style={[{ flex: 1 }, style]}
    contentContainerStyle={contentStyle}
    showsVerticalScrollIndicator={false}>
    {children}
  </ScrollView>
);
