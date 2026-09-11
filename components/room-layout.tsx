import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import type { Room as RoomModel } from '../data';
import { useSession } from '../session';
import { em, font, radius, type, useTheme } from '../theme';
import { BackIcon, LockIcon, MoreIcon } from './icons';
import { StatusStrip } from './layout';
import { Eyebrow } from './ui';

export const RoomTopBar = ({
  center,
  muted,
  room,
}: {
  center: React.ReactNode;
  muted?: boolean;
  room: RoomModel;
}) => {
  const { c } = useTheme();
  const { me } = useSession();
  // Reporting your own room would only ever name yourself, so from the host's
  // side the ⋯ reports the room alone.
  const host = room.host;
  const target =
    me && host.id === me.id
      ? `/report?room=${room.id}`
      : `/report?room=${room.id}&person=${host.id}&name=${encodeURIComponent(host.name)}`;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
        paddingHorizontal: 22,
        paddingBottom: 16,
      }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10}>
        <BackIcon color={c.ink} />
      </Pressable>
      {center}
      {/* The design's ⋯ menu has one item that leads anywhere: report. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More"
        onPress={() => router.push(target as never)}
        hitSlop={10}>
        <MoreIcon color={muted ? c.mute2 : c.ink} />
      </Pressable>
    </View>
  );
};

/** Room layout with a scrollable body and fixed footer. */
export const RoomScreen = ({
  topBar,
  contentStyle,
  footer,
  children,
}: {
  topBar: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const { c } = useTheme();

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      {topBar}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
};

/** Small outlined tag beside the status — JOINED, CASUAL, LOCKED. */
export const StateTag = ({ label, icon, filled }: { label: string; icon?: boolean; filled?: boolean }) => {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 3,
          paddingHorizontal: filled ? 9 : 8,
          borderRadius: radius.xs,
        },
        filled
          ? { backgroundColor: c.coral }
          : { borderWidth: 1, borderColor: c.hair2 },
      ]}>
      {icon ? <LockIcon size={10} color={c.mute2} /> : null}
      <Text
        style={[
          type.eyebrow,
          { fontSize: 9.5, letterSpacing: em(0.14, 9.5), color: filled ? c.onCoral : c.mute2 },
        ]}>
        {label}
      </Text>
    </View>
  );
};

export const SectionHead = ({ label, right }: { label: string; right: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>{right}</Text>
    </View>
  );
};
