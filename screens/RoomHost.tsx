import { Alert, Pressable, Share, Text, View } from 'react-native';
import { UpdateComposer, Updates } from '../components/room-updates';
import { RoomScreen, RoomTopBar, StateTag, SectionHead } from '../components/room-layout';
import { RoomMap } from '../components/room-map';
import { RoomStatus, Roster } from '../components/rooms';
import { Avatar } from '../components/avatars';
import { Chip, TextButton } from '../components/controls';
import { approveRequest, declineRequest, endRoom, useNow } from '../api';
import { useWrite } from '../feedback';
import { attendeeCountOf, endsAt, seatsLeft, statusOf, type Person, type Room as RoomModel } from '../data';
import { clock } from '../time';
import { roomShareUrl } from '../room-rules';
import { em, font, radius, type, useTheme } from '../theme';
import type { RoomScreenProps } from './Room';

/** Both host views expose the same lifecycle and sharing actions. */
const HostControls = ({ room, reload }: { room: RoomModel; reload: () => Promise<void> }) => {
  const { c } = useTheme();
  const now = useNow();
  const { busy, run } = useWrite();
  const cancel = room.startsAt > now;
  const label = cancel ? 'Cancel room' : 'End room';
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    <Chip label="Share" disabled={busy} onPress={() => run(() => Share.share({
      message: `${room.title} — ${roomShareUrl(room.id)}\nOpen this link on an iPhone with Openseat installed.`,
    }))} />
    <Chip label={label} color={c.danger} disabled={busy} onPress={() => Alert.alert(label + '?',
      cancel ? 'This cancels the meetup for everyone who joined.' : 'This closes the room for everyone. It cannot be reopened.',
      [{ text: 'Keep room open', style: 'cancel' }, { text: label, style: 'destructive',
        onPress: () => void run(async () => { await endRoom(room.id, cancel); await reload(); }) }])} />
    <Text style={{ color: c.mute, fontFamily: font.regular }}>Ends at {clock(endsAt(room))}</Text>
  </View>;
};

/** Live room, host view — stats, roster, and the host-only composer. */
export function RoomHost({ room, reload }: RoomScreenProps) {
  const { c } = useTheme();
  const now = useNow();
  const stat = (n: string, label: string) => (
    <View key={label}>
      <Text style={{ fontFamily: font.bold, fontSize: 19, color: c.ink }}>{n}</Text>
      <Text
        style={{ fontFamily: font.regular, fontSize: 11, letterSpacing: em(0.1, 11), color: c.mute2 }}>
        {label}
      </Text>
    </View>
  );
  return (
    <RoomScreen
      topBar={
        <RoomTopBar
          room={room}
          center={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RoomStatus status={statusOf(room, now)} />
              <StateTag label="YOU'RE HOSTING" filled />
            </View>
          }
        />
      }
      contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 20 }}
      footer={<UpdateComposer room={room} reload={reload} />}>
      <View>
        <Text style={[type.display, { color: c.ink }]}>{room.title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
          You're hosting · {attendeeCountOf(room)}/{room.capacity} joined
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 22,
          paddingBottom: 18,
          borderBottomWidth: 1,
          borderBottomColor: c.hair,
        }}>
        {stat(`${attendeeCountOf(room)}`, 'HERE NOW')}
        {stat(`${seatsLeft(room)}`, 'SEATS LEFT')}
      </View>

      <HostControls room={room} reload={reload} />
      <RoomMap room={room} />

      <View>
        <View style={{ marginBottom: 12 }}>
          <SectionHead label="WHO'S HERE" right={`${attendeeCountOf(room)} joined`} />
        </View>
        <Roster room={room} />
      </View>

      <Updates updates={room.updates} now={now} label="RECENT UPDATES · LATEST 20" />
    </RoomScreen>
  );
}

/** Locked room, host view — the approve/decline queue. */
export function RoomHostRequests({ room, reload }: RoomScreenProps) {
  const { c } = useTheme();
  const now = useNow();
  const { busy, run } = useWrite();
  // No local "decided" set any more: an approval moves the row to `member`, so
  // the reload takes the person out of `requests` and puts them in the roster.
  const waiting = room.requests;
  const decide = (person: Person, approve: boolean) =>
    run(async () => {
      await (approve ? approveRequest : declineRequest)(room.id, person.id);
      await reload();
    });
  const here = attendeeCountOf(room);
  return (
    <RoomScreen
      topBar={
        <RoomTopBar
          room={room}
          center={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <RoomStatus status={statusOf(room, now)} />
              <StateTag label="LOCKED" icon />
            </View>
          }
        />
      }
      contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 20 }}
      footer={
        // The footer used to be a button that routed to the other host screen
        // to find a composer. An approve-room host never reaches that screen —
        // this is their room screen — so the composer belongs here too.
        <UpdateComposer room={room} reload={reload} />
      }>
      <View>
        <Text style={[type.display, { color: c.ink }]}>{room.title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
          You're hosting · {here}/{room.capacity} joined · you approve each request
        </Text>
      </View>

      <View style={{ paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: c.hair }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}>
            <RoomStatus
              status={{
                label: `JOIN REQUESTS · ${waiting.length}`,
                tone: waiting.length ? 'live' : 'off',
              }}
            />
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>
              {Math.max(0, room.capacity - here)} seats left
            </Text>
          </View>

          {waiting.length === 0 ? (
            <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute, paddingTop: 14 }}>
              Nobody's waiting. New requests land here.
            </Text>
          ) : (
            waiting.map((p, i) => {
              return (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    borderBottomWidth: i === waiting.length - 1 ? 0 : 1,
                    borderBottomColor: c.hairFaint,
                  }}>
                  <Avatar initials={p.initials} tone={p.tone} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: c.ink }}>
                      {p.name}.
                    </Text>
                    <Text
                      style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
                      {p.year} · {p.major}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextButton
                      label="Decline"
                      disabled={busy}
                      onPress={() => decide(p, false)}
                      style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${p.name}`}
                      disabled={busy}
                      onPress={() => decide(p, true)}
                      style={{
                        paddingVertical: 7,
                        paddingHorizontal: 13,
                        borderRadius: radius.chip,
                        borderWidth: 1.5,
                        borderColor: c.ink,
                      }}>
                      <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.ink }}>
                        Approve
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}

          <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.faint, marginTop: 12 }}>
            Requests close when the room ends. The venue is visible before approval.
          </Text>
        </View>

      <HostControls room={room} reload={reload} />
      <RoomMap room={room} />

      <View>
        <View style={{ marginBottom: 12 }}>
          <SectionHead label="WHO'S HERE" right={`${here} approved`} />
        </View>
        <Roster room={room} showOpenSeats />
      </View>
    </RoomScreen>
  );
}
