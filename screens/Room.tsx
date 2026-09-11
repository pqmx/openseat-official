import { RoomScreen, RoomTopBar, StateTag, SectionHead } from '../components/room-layout';
import { Updates } from '../components/room-updates';
import {
  Text,
  View,
} from 'react-native';
import { RoomMap } from '../components/room-map';
import { RoomRow, RoomStatus, Roster } from '../components/rooms';
import { LockIcon } from '../components/icons';
import { PrimaryButton, TextButton } from '../components/controls';
import { Eyebrow, NoteItem } from '../components/ui';
import { Footer } from '../components/layout';
import {
  joinRoom,
  leaveRoom,
  useNow,
} from '../api';
import { useWrite } from '../feedback';
import {
  feedFor,
  attendeeCountOf,
  isEnded,
  hasAsked,
  isIn,
  isLive,
  seatsLeft,
  statusOf,
  type Room as RoomModel,
} from '../data';
import { useSession } from '../session';
import { router } from 'expo-router';
import { ago } from '../time';
import { em, font, radius, type, useTheme } from '../theme';

/** Shared props for room route variants. */
export type RoomScreenProps = { room: RoomModel; rooms: RoomModel[]; reload: () => Promise<void> };

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
