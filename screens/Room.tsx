import { useState } from 'react';
import { Linking, Pressable, Share, Text, TextInput, View } from 'react-native';
import { RoomRow, RoomStatus } from '../components/rooms';
import { BackIcon, LockIcon, MoreIcon } from '../components/icons';
import {
  Avatar,
  AvatarCell,
  Body,
  Chip,
  Dot,
  Eyebrow,
  Footer,
  MapPlate,
  NoteItem,
  PrimaryButton,
  SlotCell,
  StatusStrip,
  TextButton,
} from '../components/ui';
import {
  feedFor,
  hostOf,
  isLive,
  personById,
  rosterOf,
  seatsLeft,
  statusOf,
  useNow,
  you,
  type Person,
  type Room as RoomModel,
  type Update,
} from '../data';
import { router } from 'expo-router';
import { ago } from '../time';
import { em, font, radius, type, useTheme } from '../theme';

const RoomTopBar = ({ center, muted }: { center: React.ReactNode; muted?: boolean }) => {
  const { c } = useTheme();
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
        onPress={() => router.push('/report')}
        hitSlop={10}>
        <MoreIcon color={muted ? c.mute2 : c.ink} />
      </Pressable>
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
const Roster = ({
  room,
  extra = [],
  showOpenSeats,
}: {
  room: RoomModel;
  /** Anyone approved during this session. */
  extra?: Person[];
  showOpenSeats?: boolean;
}) => {
  const named = [...rosterOf(room), ...extra].slice(0, 6);
  const unnamed = room.attendees.length + extra.length - named.length;
  const open = seatsLeft(room) - extra.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {named.map((p) => (
        <AvatarCell
          key={p.id}
          initials={p.initials}
          name={p.id === you.id ? 'You' : p.short}
          tone={p.tone}
          host={p.id === room.hostId}
          onPress={() => router.push(p.id === you.id ? '/you' : `/profile/${p.id}`)}
        />
      ))}
      {showOpenSeats
        ? open > 0 && <SlotCell badge={`${open}`} label="open" />
        : unnamed > 0 && <SlotCell badge={`+${unnamed}`} label="more" />}
    </View>
  );
};

/** Precise-location map card, shown once you're in the room. */
const RoomMap = ({ room }: { room: RoomModel }) => {
  const { c } = useTheme();
  return (
    <MapPlate
      cellW={92}
      cellH={104}
      style={{ height: 150, borderRadius: radius.map, borderWidth: 1, borderColor: c.hair }}>
      <View
        style={{ position: 'absolute', left: 0, bottom: 0, width: 150, height: 70, backgroundColor: c.park }}
      />
      <View
        style={{ position: 'absolute', left: '50%', top: '42%', transform: [{ translateX: -13 }, { translateY: -13 }] }}>
        <Dot color={c.green} size={14} glow={c.greenGlow} glowWidth={6} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          right: 14,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 10,
        }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: c.ink }}>{room.place}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.mute }}>
            {room.street} · {room.walkMinutes} min walk
          </Text>
        </View>
        <TextButton
          label="Directions"
          onPress={() =>
            Linking.openURL(
              `http://maps.apple.com/?q=${encodeURIComponent(`${room.place}, ${room.street}`)}`
            )
          }
          style={{ fontFamily: font.medium, fontSize: 12.5, color: c.blue }}
        />
      </View>
    </MapPlate>
  );
};

const Updates = ({ updates, now, label }: { updates: Update[]; now: Date; label: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <Eyebrow>{label}</Eyebrow>
      {updates.length === 0 ? (
        <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
          Nothing posted yet.
        </Text>
      ) : (
        updates.map((u, i) => {
          const author = personById(u.byId);
          const mine = u.byId === you.id;
          return (
            <NoteItem
              key={u.id}
              text={u.text}
              meta={[
                mine ? 'You' : author?.name,
                ago(u.at, now),
                u.seenBy ? `seen by ${u.seenBy}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              accent={i === 0 ? c.green : undefined}
              muted={i > 0}
            />
          );
        })
      )}
    </View>
  );
};

/** Live room, member view. */
export function Room({ room }: { room: RoomModel }) {
  const { c } = useTheme();
  const now = useNow();
  const host = hostOf(room);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RoomStatus status={statusOf(room, now)} />
            <StateTag label={room.attendees.includes(you.id) ? 'JOINED' : 'OPEN'} />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}>
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
      </Body>

      <Footer>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
          <LockIcon color={c.mute2} />
          <Text
            style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, lineHeight: 12.5 * 1.4 }}>
            Only {host.short} posts updates.{'\n'}You'll get a ping for each one.
          </Text>
        </View>
        <TextButton
          label="Leave room"
          onPress={() => router.replace('/discover')}
          style={{ fontFamily: font.regular, fontSize: 13, color: c.danger }}
        />
      </Footer>
    </View>
  );
}

/** Live room, host view — stats, roster, and the host-only composer. */
export function RoomHost({ room }: { room: RoomModel }) {
  const { c } = useTheme();
  const now = useNow();
  const [draft, setDraft] = useState('');
  const [posted, setPosted] = useState<RoomModel['updates']>([]);
  const updates = [...posted, ...room.updates];
  const post = () => {
    const text = draft.trim();
    if (!text) return;
    setPosted((p) => [
      { id: `u${Date.now()}`, text, at: new Date(), byId: you.id, seenBy: 0 },
      ...p,
    ]);
    setDraft('');
  };
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
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RoomStatus status={statusOf(room, now)} />
            <StateTag label="YOU'RE HOSTING" filled />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 20 }}>
        <View>
          <Text style={[type.display, { color: c.ink }]}>{room.title}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            You're hosting · {room.attendees.length} joined · cap {room.capacity}
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
            <Chip
              label="End room"
              color={c.danger}
              style={{ paddingVertical: 6 }}
              onPress={() => router.replace(`/room/${room.id}?view=canceled`)}
            />
          </View>
        </View>

        <View>
          <View style={{ marginBottom: 12 }}>
            <SectionHead label="WHO'S HERE" right={`${room.attendees.length} here now`} />
          </View>
          <Roster room={room} />
        </View>

        <Updates updates={updates} now={now} label="YOUR UPDATES" />
      </Body>

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
            label="Post update"
            height={38}
            onPress={post}
            style={{
              paddingHorizontal: 20,
              borderRadius: radius.md,
              backgroundColor: draft.trim() ? c.coral : c.disabled,
            }}
          />
        </View>
      </Footer>
    </View>
  );
}

/** Locked room, host view — the approve/decline queue. */
export function RoomHostRequests({ room }: { room: RoomModel }) {
  const { c } = useTheme();
  const now = useNow();
  const [decidedIds, setDecidedIds] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Person[]>([]);
  const waiting = room.requests.filter((id) => !decidedIds.has(id));
  const decide = (id: string, approve: boolean) => {
    setDecidedIds((v) => new Set(v).add(id));
    const person = personById(id);
    if (approve && person) setApproved((v) => [...v, person]);
  };
  const here = room.attendees.length + approved.length;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <RoomStatus status={statusOf(room, now)} />
            <StateTag label="LOCKED" icon />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 20 }}>
        <View>
          <Text style={[type.display, { color: c.ink }]}>{room.title}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            You're hosting · {here} joined · cap {room.capacity} · you approve each request
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
            waiting.map((id, i) => {
              const p = personById(id);
              if (!p) return null;
              return (
                <View
                  key={id}
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
                      onPress={() => decide(id, false)}
                      style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${p.name}`}
                      onPress={() => decide(id, true)}
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

        <View>
          <View style={{ marginBottom: 12 }}>
            <SectionHead label="WHO'S HERE" right={`${here} approved`} />
          </View>
          <Roster room={room} extra={approved} showOpenSeats />
        </View>
      </Body>

      <Footer>
        <Text
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
          Only you post{'\n'}updates here
        </Text>
        <PrimaryButton
          label="Post an update"
          onPress={() => router.replace(`/room/${room.id}?view=host`)}
          style={{ flex: 1 }}
        />
      </Footer>
    </View>
  );
}

/**
 * Casual room before joining. Small rooms keep their pin private — the map
 * shows an approximate area until you're in.
 */
export function RoomCasualPreJoin({ room }: { room: RoomModel }) {
  const { c } = useTheme();
  const now = useNow();
  const host = hostOf(room);
  const left = seatsLeft(room);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RoomStatus status={statusOf(room, now)} />
            <StateTag label="CASUAL" />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}>
        <View>
          <Text style={[type.displayLg, { color: c.ink }]}>{room.title}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            {host.name} · {host.year}, {host.major} · {room.attendees.length} of {room.capacity} seats
          </Text>
        </View>

        <View>
          <MapPlate
            cellW={92}
            cellH={104}
            blur
            style={{ height: 150, borderRadius: radius.map, borderWidth: 1, borderColor: c.hair }}>
            <View
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: 150,
                height: 70,
                backgroundColor: c.park,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: '50%',
                top: '44%',
                width: 132,
                height: 132,
                borderRadius: radius.round,
                backgroundColor: c.greenGlow,
                transform: [{ translateX: -66 }, { translateY: -66 }],
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: '50%',
                top: '44%',
                width: 120,
                height: 120,
                borderRadius: radius.round,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: c.dash,
                transform: [{ translateX: -60 }, { translateY: -60 }],
              }}
            />
            <Text
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '44%',
                textAlign: 'center',
                fontFamily: font.medium,
                fontSize: 12.5,
                color: c.ink2,
                transform: [{ translateY: -8 }],
              }}>
              Near {room.street}
            </Text>
            <View
              style={{
                position: 'absolute',
                left: 14,
                bottom: 12,
                right: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
              }}>
              <LockIcon color={c.mute2} />
              <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.mute }}>
                Approximate area · about a {room.walkMinutes} min walk
              </Text>
            </View>
          </MapPlate>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 12.5,
              lineHeight: 12.5 * 1.5,
              color: c.mute,
              marginTop: 10,
            }}>
            Small rooms keep their spot private. The exact place and address show up the moment you
            join.
          </Text>
        </View>

        <View>
          <View style={{ marginBottom: 14 }}>
            <SectionHead label="WHO'S GOING" right={`${room.attendees.length} going`} />
          </View>
          <Roster room={room} showOpenSeats />
        </View>

        {room.blurb ? (
          <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair }}>
            <Eyebrow>FROM {host.short.toUpperCase()}</Eyebrow>
            <Text
              style={{
                fontFamily: font.regular,
                fontSize: 14.5,
                lineHeight: 14.5 * 1.5,
                color: c.ink2,
                marginTop: 8,
              }}>
              {room.blurb}
            </Text>
          </View>
        ) : null}
      </Body>

      <Footer>
        <Text
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
          Address unlocks{'\n'}after you join
        </Text>
        {/* Joining is what reveals the exact pin — the joined room is that view. */}
        <PrimaryButton
          label={left ? `Join · ${left} ${left === 1 ? 'seat' : 'seats'} left` : 'Room is full'}
          onPress={() => left && router.replace(`/room/${room.id}?view=member`)}
          style={{ flex: 1, backgroundColor: left ? c.coral : c.disabled }}
        />
      </Footer>
    </View>
  );
}

/** Host called it off. No push, no alert colour — you meet this on opening. */
export function RoomCanceled({ room }: { room: RoomModel }) {
  const { c } = useTheme();
  const now = useNow();
  const host = hostOf(room);
  const last = room.updates[0];
  const alternative = feedFor(you.year, now).find((r) => r.id !== room.id && isLive(r, now));
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar muted center={<RoomStatus status={{ label: 'CANCELED', tone: 'off' }} />} />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 6, gap: 24, flexGrow: 1 }}>
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
            Nothing's happening at {room.street} tonight. You're off the list — no need to tell
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
      </Body>

      <Footer column gap={12}>
        <PrimaryButton label="Back to Discover" onPress={() => router.replace('/discover')} />
        <Text
          style={{ fontFamily: font.regular, fontSize: 12.5, color: c.faint, textAlign: 'center' }}>
          This room is closed for good
        </Text>
      </Footer>
    </View>
  );
}
