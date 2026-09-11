import { UpdateComposer, Updates } from '../components/room-updates';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RoomMap } from '../components/room-map';
import { RoomRow, RoomStatus, Roster } from '../components/rooms';
import { BackIcon, LockIcon, MoreIcon } from '../components/icons';
import {
  Avatar,
  Chip,
  Eyebrow,
  Footer,
  NoteItem,
  PrimaryButton,
  StatusStrip,
  TextButton,
} from '../components/ui';
import {
  approveRequest,
  declineRequest,
  endRoom,
  joinRoom,
  leaveRoom,
  useNow,
} from '../api';
import { useWrite } from '../feedback';
import {
  feedFor,
  attendeeCountOf,
  endsAt,
  isEnded,
  hasAsked,
  isIn,
  isLive,
  seatsLeft,
  statusOf,
  type Person,
  type Room as RoomModel,
} from '../data';
import { useSession } from '../session';
import { router } from 'expo-router';
import { ago, clock } from '../time';
import { roomShareUrl } from '../room-rules';
import { em, font, radius, type, useTheme } from '../theme';

/** Shared props for room route variants. */
export type RoomScreenProps = { room: RoomModel; rooms: RoomModel[]; reload: () => Promise<void> };

const RoomTopBar = ({
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
const RoomScreen = ({
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
const StateTag = ({ label, icon, filled }: { label: string; icon?: boolean; filled?: boolean }) => {
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

const SectionHead = ({ label, right }: { label: string; right: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Eyebrow>{label}</Eyebrow>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>{right}</Text>
    </View>
  );
};

/** Join or request access, subject to available seats. */
const JoinButton = ({ room, reload }: { room: RoomModel; reload: () => Promise<void> }) => {
  const { c } = useTheme();
  const { me } = useSession();
  const { busy, run } = useWrite();
  const left = seatsLeft(room);
  const asked = !!me && hasAsked(room, me);
  return (
    <PrimaryButton
      label={
        asked
          ? 'Asked to join'
          : !left
            ? 'Room is full'
            : busy
              ? 'Joining…'
              : room.access === 'approve'
                ? 'Ask to join'
                : `Join · ${left} ${left === 1 ? 'seat' : 'seats'} left`
      }
      disabled={asked || !left || busy}
      onPress={() => me && run(async () => {
        await joinRoom(room.id, me.id, room.access);
        await reload();
      })}
      style={{ flex: 1, backgroundColor: asked || !left ? c.disabled : c.coral }}
    />
  );
};

/** Room details for members, pending requests, and visitors. */
export function Room({ room, reload }: RoomScreenProps) {
  const { c } = useTheme();
  const { me } = useSession();
  const now = useNow();
  const { busy, run } = useWrite();
  const host = room.host;
  const joined = !!me && isIn(room, me);
  const asked = !!me && hasAsked(room, me);
  return (
    <RoomScreen
      topBar={
        <RoomTopBar
          room={room}
          center={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RoomStatus status={statusOf(room, now)} />
              <StateTag label={joined ? 'JOINED' : asked ? 'ASKED' : 'OPEN'} />
            </View>
          }
        />
      }
      contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}
      footer={
        <Footer>
          {joined ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
                <LockIcon color={c.mute2} />
                <Text
                  style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, lineHeight: 12.5 * 1.4 }}>
                  Only {host.short} posts updates.{'\n'}Open this room to check for changes.
                </Text>
              </View>
              <TextButton
                label={busy ? 'Leaving…' : 'Leave room'}
                disabled={busy}
                // Back to Discover rather than this screen: you're no longer in
                // the room, and the roster you'd be looking at is no longer yours.
                onPress={() =>
                  me && run(async () => {
                    await leaveRoom(room.id, me.id);
                    router.replace('/discover');
                  })
                }
                style={{ fontFamily: font.regular, fontSize: 13, color: c.danger }}
              />
            </>
          ) : (
            <>
              <Text
                style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
                {asked ? `Waiting on\n${host.short}` : `${attendeeCountOf(room)} of ${room.capacity}\nseats taken`}
              </Text>
              {asked ? <TextButton label={busy ? 'Withdrawing…' : 'Withdraw request'} disabled={busy}
                onPress={() => me && run(async () => { await leaveRoom(room.id, me.id); await reload(); })}
                style={{ color: c.danger }} /> : <JoinButton room={room} reload={reload} />}
            </>
          )}
        </Footer>
      }>
      <View>
        <Text style={[type.displayLg, { color: c.ink }]}>{room.title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
          Hosted by {host.name} · {host.year}, {host.major}
        </Text>
      </View>

      <RoomMap room={room} />

      <View>
        <View style={{ marginBottom: 14 }}>
          <SectionHead
            label="WHO'S HERE"
            right={
              isLive(room, now)
                ? `${attendeeCountOf(room)} joined`
                : `${attendeeCountOf(room)} going`
            }
          />
        </View>
        <Roster room={room} />
      </View>

      <Updates updates={room.updates} now={now} label="RECENT HOST UPDATES · LATEST 20" />
    </RoomScreen>
  );
}

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
        <HostControls room={room} reload={reload} />
      </View>

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

/** Host called it off. No push, no alert colour — you meet this on opening. */
export function RoomCanceled({ room, rooms }: RoomScreenProps) {
  const { c } = useTheme();
  const { me } = useSession();
  const now = useNow();
  const host = room.host;
  const last = room.updates[0];
  const ended = !room.canceledAt && isEnded(room, now);
  const alternative = feedFor(rooms, me?.year ?? '', now).find(
    (r) => r.id !== room.id && isLive(r, now)
  );
  return (
    <RoomScreen
      topBar={
        <RoomTopBar muted room={room} center={<RoomStatus status={{ label: ended ? 'ENDED' : 'CANCELED', tone: 'off' }} />} />
      }
      contentStyle={{ paddingHorizontal: 22, paddingBottom: 6, gap: 24, flexGrow: 1 }}
      footer={
        <Footer column gap={12}>
          <PrimaryButton label="Back to Discover" onPress={() => router.replace('/discover')} />
          <Text
            style={{ fontFamily: font.regular, fontSize: 12.5, color: c.faint, textAlign: 'center' }}>
            This room is closed for good
          </Text>
        </Footer>
      }>
      <View>
        <Text style={[type.display, { color: c.ink2 }]}>
          {ended ? 'This room has ended.' : `${host.short} canceled this room.`}
        </Text>
        <Text
          style={{
            fontFamily: font.regular,
            fontSize: 14,
            lineHeight: 14 * 1.55,
            color: c.mute,
            marginTop: 10,
            maxWidth: 302,
          }}>
          {ended ? 'This meetup is finished. You can find another room or start a new one.' : `The meetup at ${room.place} was canceled. You do not need to attend.`}
        </Text>
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: radius.card,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: c.dash,
          gap: 6,
        }}>
        <Eyebrow>WAS SET FOR</Eyebrow>
        <Text
          style={{
            fontFamily: font.bold,
            fontSize: 18,
            letterSpacing: em(-0.018, 18),
            color: c.ink2,
          }}>
          {room.title}
        </Text>
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}>
          {room.place} · {attendeeCountOf(room)} had joined
        </Text>
      </View>

      {last ? (
        <View style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: c.hair }}>
          <Eyebrow>{host.short.toUpperCase()}'S LAST NOTE</Eyebrow>
          <View style={{ marginTop: 12 }}>
            <NoteItem text={last.text} meta={`${host.name} · ${ago(last.at, now)}`} muted />
          </View>
        </View>
      ) : null}

      {alternative ? (
        <View
          style={{
            marginTop: 'auto',
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: c.hair,
            gap: 14,
          }}>
          <Eyebrow>STILL LIVE NEARBY</Eyebrow>
          <RoomRow room={alternative} now={now} small />
        </View>
      ) : null}
    </RoomScreen>
  );
}
