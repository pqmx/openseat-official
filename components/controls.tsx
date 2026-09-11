import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { font, radius, useTheme } from '../theme';
import { Eyebrow } from './ui';

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
          minHeight: height,
          paddingVertical: 10,
          paddingHorizontal: 12,
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
  disabled,
}: {
  label: string;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
  disabled?: boolean;
}) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={8}>
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
  disabled,
}: {
  label: string;
  selected?: boolean;
  dashed?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
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
      hitSlop={10}
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
