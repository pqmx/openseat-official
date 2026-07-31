import { Pressable, Text, View } from 'react-native';
import { hostOf, metaOf, rosterOf, seatsLeft, statusOf, type Room, type Status } from '../data';
import { router } from 'expo-router';
import { em, font, radius, type, useTheme } from '../theme';
import { PeelCorner } from './icons';
import { Avatar, PrimaryButton, StatusLine } from './ui';

/** One rule for how a room's status reads, everywhere a room appears. */
export const RoomStatus = ({ status, small }: { status: Status; small?: boolean }) => {
  const { c } = useTheme();
  const tone =
    status.tone === 'live'
      ? { color: c.green, pulse: true }
      : status.tone === 'soon'
        ? { color: c.blue, pulse: false }
        : { color: c.mute2, pulse: false };
  return (
    <StatusLine
      label={status.label}
      color={tone.color}
      pulse={tone.pulse}
      outline={status.tone === 'off'}
      small={small}
    />
  );
};

/** The three overlapping avatars and the tail count on a live card. */
const AvatarStack = ({ room }: { room: Room }) => {
  const { c } = useTheme();
  const shown = rosterOf(room).slice(0, 3);
  const rest = room.attendees.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <View key={p.id} style={i === 0 ? undefined : { marginLeft: -7 }}>
          <Avatar initials={p.initials} tone={p.tone} size={24} stacked />
        </View>
      ))}
      {rest > 0 ? (
        <Text style={{ marginLeft: 9, fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>
          +{rest} here
        </Text>
      ) : null}
    </View>
  );
};

/** The raised, peeling hero card at the top of a feed. */
export const RoomCard = ({ room, now }: { room: Room; now: Date }) => {
  const { c } = useTheme();
  const open = () => router.push(`/room/${room.id}`);
  const full = seatsLeft(room) === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={room.title}
      onPress={open}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: radius.card,
        backgroundColor: c.raised,
        borderWidth: 1,
        borderColor: c.hair,
      }}>
      <RoomStatus status={statusOf(room, now)} />
      <Text style={[type.cardTitle, { color: c.ink, marginTop: 8, paddingRight: 30 }]}>
        {room.title}
      </Text>
      {/* The avatar row below already carries the head count. */}
      <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 5 }}>
        {room.place} · {room.walkMinutes} min · {hostOf(room).name}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}>
        <AvatarStack room={room} />
        <PrimaryButton
          label={full ? 'Full' : room.access === 'approve' ? 'Ask to join' : 'Join'}
          height={34}
          onPress={open}
          style={{
            paddingHorizontal: 16,
            borderRadius: radius.join,
            backgroundColor: full ? c.disabled : c.coral,
          }}
        />
      </View>
      <PeelCorner
        id={`peel-${room.id}`}
        surface={c.surface}
        raised={c.raised}
        hair={c.hair}
        hair2={c.hair2}
      />
    </Pressable>
  );
};

/** Plain feed row — status, title, meta, no card. */
export const RoomRow = ({
  room,
  now,
  small,
  right,
}: {
  room: Room;
  now: Date;
  /** The tighter type used in secondary lists. */
  small?: boolean;
  right?: string;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={room.title}
      onPress={() => router.push(`/room/${room.id}`)}
      style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <RoomStatus status={statusOf(room, now)} small={small} />
        <Text
          style={
            small
              ? {
                  fontFamily: font.bold,
                  fontSize: 17,
                  letterSpacing: em(-0.018, 17),
                  color: c.ink,
                  marginTop: 6,
                }
              : [type.cardTitle, { color: c.ink, marginTop: 8 }]
          }>
          {room.title}
        </Text>
        <Text
          style={{
            fontFamily: font.regular,
            fontSize: small ? 12.5 : 13,
            color: c.mute,
            marginTop: small ? 3 : 5,
          }}>
          {metaOf(room, now)}
        </Text>
      </View>
      {right ? (
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>{right}</Text>
      ) : null}
    </Pressable>
  );
};

/** Shared by the Rooms tab and the canceled room's "still live nearby". */
export const RoomList = ({ items, now }: { items: Room[]; now: Date }) => {
  const { c } = useTheme();
  return (
    <View>
      {items.map((room, i) => (
        <View
          key={room.id}
          style={
            i === 0
              ? undefined
              : { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.hairFaint }
          }>
          <RoomRow room={room} now={now} small />
        </View>
      ))}
    </View>
  );
};
