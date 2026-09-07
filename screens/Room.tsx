import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { RoomRow, RoomStatus, Roster } from '../components/rooms';
import { BackIcon, LockIcon, MoreIcon } from '../components/icons';
import {
  Avatar,
  Chip,
  Dot,
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
  postUpdate,
  useNow,
  useWrite,
} from '../api';
import {
  feedFor,
  hasAsked,
  hostOf,
  isIn,
  isLive,
  mapsUrl,
  seatsLeft,
  showsExactPin,
  statusOf,
  type MapsApp,
  type Person,
  type Room as RoomModel,
  type Update,
} from '../data';
import { getMapsApp, setMapsApp } from '../prefs';
import { useSession } from '../session';

/**
 * One shape for all five views, because `app/room/[id].tsx` picks between them
 * at runtime — they have to be interchangeable. Only the canceled one reads
 * `rooms`, to offer somewhere else to be. `reload` refetches after a write, so
 * the screen redraws from what the database now says rather than from a guess.
 */
export type RoomScreenProps = { room: RoomModel; rooms: RoomModel[]; reload: () => Promise<void> };
import { router } from 'expo-router';
import { ago } from '../time';
import { em, font, radius, type, useTheme } from '../theme';

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
  const host = hostOf(room);
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

/**
 * The shell every room view shares — status strip, top bar, scrollable body,
 * footer. No dismissal gesture: the navigator owns every one, and iOS's own
 * edge-swipe back already is the pop.
 */
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
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      {topBar}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer}
    </View>
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

/**
 * The "who's here" grid. Named people first, then one dashed cell standing in
 * for whoever the roster doesn't name — or for the seats still open.
 */
/**
 * Precise-location map card, shown on every screen that has the pin — member,
 * host and the approve queue. The host holds a `room_members` row like anyone
 * else, so `room_pins` sends them coordinates too; leaving the plate off their
 * screen only meant the person who has to get there first couldn't tap it.
 */
const RoomMap = ({ room }: { room: RoomModel }) => {
  const { c } = useTheme();
  // The coordinates the plate draws are the same ones `mapsUrl` hands off, so
  // the picture and the link can't disagree about where the room is.
  const exact = showsExactPin(room);
  const lat = exact ? room.lat : room.approxLat;
  const lng = exact ? room.lng : room.approxLng;
  // iOS has no API for "your preferred maps app" — the setting doesn't exist,
  // so the only honest way to know is to ask. But asking on every tap is a
  // dialog between someone and the place they're trying to walk to, so it is
  // asked once and remembered. `Alert` rather than `ActionSheetIOS` because
  // this screen ships on Android too, where an action sheet would need a
  // dependency to do what three buttons already do.
  const pick = (app: MapsApp) => {
    void setMapsApp(app);
    void Linking.openURL(mapsUrl(room, app));
  };

  const openMaps = async () => {
    const saved = await getMapsApp();
    if (saved) return void Linking.openURL(mapsUrl(room, saved));
    Alert.alert(
      room.place,
      // Say that it sticks. Quietly remembering an answer nobody was told you'd
      // keep is how a preference turns into a surprise.
      "Open room locations in — you can change this later on your profile.",
      [
        { text: 'Google Maps', onPress: () => pick('google') },
        { text: 'Apple Maps', onPress: () => pick('apple') },
        // Deliberately saves nothing, so a dismissed dialog asks again.
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${room.place} in Maps`}
      accessibilityHint="Choose Apple Maps or Google Maps"
      onPress={openMaps}
      style={{
        height: 150,
        borderRadius: radius.map,
        borderWidth: 1,
        borderColor: c.hair,
        overflow: 'hidden',
      }}>
      {/*
       * `pointerEvents="none"` is what makes the plate a button rather than a
       * map. MapView eats every touch it's given — pan, pinch, tap — so with
       * gestures merely disabled the press would still never reach the
       * Pressable. Panning here would be pointless anyway: the destination is
       * another app, and this is a picture of where you're going.
       */}
      <MapView
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        region={{
          latitude: lat,
          longitude: lng,
          // ~600m across, so the pin sits in a block you can recognise.
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        // Same reason as Discover: fifty storefront pins beat one room pin.
        showsPointsOfInterests={false}>
        {exact ? (
          <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <Dot color={c.green} size={14} glow={c.greenGlow} glowWidth={6} />
          </Marker>
        ) : (
          /*
           * No exact pin means the server withheld it — the same 150m circle
           * Discover draws, for the same reason. Never a dot on the coarse
           * coordinate, which would look like an address it isn't.
           */
          <Circle
            center={{ latitude: lat, longitude: lng }}
            radius={150}
            strokeColor={c.blue}
            strokeWidth={1}
            fillColor={c.greenGlow}
          />
        )}
      </MapView>
      {/* Legibility over the map, which is busier than the drawn plate was. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 22,
          paddingHorizontal: 14,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 10,
          backgroundColor: c.surface94,
        }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: c.ink }}>{room.place}</Text>
        </View>
        {/* The whole plate is the button now, so this is the affordance, not a
            second target nested inside the first. */}
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.blue }}>Directions</Text>
      </View>
    </Pressable>
  );
};

/**
 * The one way into a room. Joining is one write and it has the same four things
 * to say wherever the button appears.
 */
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
      onPress={() => me && run(async () => (await joinRoom(room.id, me.id, room.access), reload()))}
      style={{ flex: 1, backgroundColor: asked || !left ? c.disabled : c.coral }}
    />
  );
};

const Updates = ({ updates, now, label }: { updates: Update[]; now: Date; label: string }) => {
  const { c } = useTheme();
  const { me } = useSession();
  return (
    <View style={{ gap: 14 }}>
      <Eyebrow>{label}</Eyebrow>
      {updates.length === 0 ? (
        <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
          Nothing posted yet.
        </Text>
      ) : (
        updates.map((u, i) => {
          const mine = u.by.id === me?.id;
          return (
            <NoteItem
              key={u.id}
              text={u.text}
              meta={[mine ? 'You' : u.by.name, ago(u.at, now)].join(' · ')}
              accent={i === 0 ? c.green : undefined}
              muted={i > 0}
            />
          );
        })
      )}
    </View>
  );
};

/**
 * Live room, member view — and, because `viewOf` sends non-members of an open
 * room here too, the view where you join one. The design only ever drew the
 * joined state; the footer below is the same screen before you're in it.
 */
export function Room({ room, reload }: RoomScreenProps) {
  const { c } = useTheme();
  const { me } = useSession();
  const now = useNow();
  const { busy, run } = useWrite();
  const host = hostOf(room);
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
                  Only {host.short} posts updates.{'\n'}You'll get a ping for each one.
                </Text>
              </View>
              <TextButton
                label={busy ? 'Leaving…' : 'Leave room'}
                // Back to Discover rather than this screen: you're no longer in
                // the room, and the roster you'd be looking at is no longer yours.
                onPress={() =>
                  me && run(async () => (await leaveRoom(room.id, me.id), router.replace('/discover')))
                }
                style={{ fontFamily: font.regular, fontSize: 13, color: c.danger }}
              />
            </>
          ) : (
            <>
              <Text
                style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
                {asked ? `Waiting on\n${host.short}` : `${room.attendees.length} of ${room.capacity}\nseats taken`}
              </Text>
              <JoinButton room={room} reload={reload} />
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
                ? `${room.attendees.length} here now`
                : `${room.attendees.length} going`
            }
          />
        </View>
        <Roster room={room} />
      </View>

      <Updates updates={room.updates} now={now} label="HOST UPDATES" />
    </RoomScreen>
  );
}

/**
 * The host-only composer. Shared by both host screens rather than copied into
 * each: whichever one you're looking at, posting an update is the same write.
 */
const UpdateComposer = ({ room, reload }: { room: RoomModel; reload: () => Promise<void> }) => {
  const { c } = useTheme();
  const { me } = useSession();
  const { busy, run } = useWrite();
  const [draft, setDraft] = useState('');
  const post = () => {
    const text = draft.trim();
    if (!text || !me) return;
    run(async () => {
      await postUpdate(room.id, me.id, text);
      setDraft('');
      await reload();
    });
  };
  return (
    <Footer raised column gap={11}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.eyebrow, { color: c.green }]}>POST AN UPDATE · HOST ONLY</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.faint }}>
          Pings all {room.attendees.length}
        </Text>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder="Tell the room something"
        placeholderTextColor={c.faint}
        selectionColor={c.coral}
        style={{
          minHeight: 52,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: draft ? c.ink : c.hair2,
          backgroundColor: c.surface,
          fontFamily: font.regular,
          fontSize: 14,
          lineHeight: 14 * 1.45,
          color: c.ink,
        }}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>
          Members can't post here
        </Text>
        <PrimaryButton
          label={busy ? 'Posting…' : 'Post update'}
          height={38}
          disabled={!draft.trim() || busy}
          onPress={post}
          style={{
            paddingHorizontal: 20,
            borderRadius: radius.md,
            backgroundColor: draft.trim() && !busy ? c.coral : c.disabled,
          }}
        />
      </View>
    </Footer>
  );
};

/** Live room, host view — stats, roster, and the host-only composer. */
export function RoomHost({ room, reload }: RoomScreenProps) {
  const { c } = useTheme();
  const now = useNow();
  const { run } = useWrite();
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
          You're hosting · {room.attendees.length}/{room.capacity} joined
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
        {stat(`${room.attendees.length}`, 'HERE NOW')}
        {stat(`${seatsLeft(room)}`, 'SEATS LEFT')}
        <View style={{ marginLeft: 'auto', alignSelf: 'center', flexDirection: 'row', gap: 8 }}>
          <Chip
            label="Share"
            style={{ paddingVertical: 6 }}
            onPress={() =>
              Share.share({ message: `${room.title} — open seat on openseat` })
            }
          />
          {/* No confirm step: the design doesn't draw one, and the canceled
              screen it lands on is unambiguous about what just happened. */}
          <Chip
            label="End room"
            color={c.danger}
            style={{ paddingVertical: 6 }}
            onPress={() => run(async () => (await endRoom(room.id), reload()))}
          />
        </View>
      </View>

      <RoomMap room={room} />

      <View>
        <View style={{ marginBottom: 12 }}>
          <SectionHead label="WHO'S HERE" right={`${room.attendees.length} here now`} />
        </View>
        <Roster room={room} />
      </View>

      <Updates updates={room.updates} now={now} label="YOUR UPDATES" />
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
  const here = room.attendees.length;
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
            Requests close when the room ends. Nobody sees the address until you approve.
          </Text>
        </View>

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
  const host = hostOf(room);
  const last = room.updates[0];
  const alternative = feedFor(rooms, me?.year ?? '', now).find(
    (r) => r.id !== room.id && isLive(r, now)
  );
  return (
    <RoomScreen
      topBar={
        <RoomTopBar muted room={room} center={<RoomStatus status={{ label: 'CANCELED', tone: 'off' }} />} />
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
          {host.short} called off the {room.title.split(' ').slice(0, 2).join(' ').toLowerCase()}.
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
          Nothing's happening at {room.place} tonight. You're off the list — no need to tell
          anyone.
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
          {room.place} · {room.attendees.length} had joined
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
