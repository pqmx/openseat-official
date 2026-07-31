import { useState } from 'react';
import { Linking, Pressable, Share, Text, TextInput, View } from 'react-native';
import { BackIcon, LockIcon, MoreIcon } from '../components/icons';
import {
  Avatar,
  AvatarCell,
  Body,
  Chip,
  Dot,
  MapPlate,
  NoteItem,
  PrimaryButton,
  SlotCell,
  StatusStrip,
  StatusLine,
  TextButton,
} from '../components/ui';
import { useNav } from '../nav';
import { em, font, radius, type, useTheme } from '../theme';

/** The roster the design's `renderVals()` builds. */
export const roster = [
  { initials: 'MJ', name: 'Maya', host: true },
  { initials: 'AT', name: 'Ade' },
  { initials: 'RK', name: 'Ro' },
  { initials: 'SP', name: 'Sam' },
  { initials: 'DL', name: 'Dee' },
  { initials: 'NB', name: 'Nia' },
  { initials: 'JC', name: 'Jos' },
  { initials: 'TV', name: 'Theo' },
  { initials: 'EM', name: 'Emi' },
];

const RoomTopBar = ({
  center,
  muted,
  paddingBottom = 16,
}: {
  center: React.ReactNode;
  muted?: boolean;
  paddingBottom?: number;
}) => {
  const { c } = useTheme();
  const { back, go } = useNav();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 4,
        paddingHorizontal: 22,
        paddingBottom,
      }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={10}>
        <BackIcon color={c.ink} />
      </Pressable>
      {center}
      {/* The design's ⋯ menu has one item that leads anywhere: report. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More"
        onPress={() => go('report')}
        hitSlop={10}>
        <MoreIcon color={muted ? c.mute2 : c.ink} />
      </Pressable>
    </View>
  );
};

/** Small outlined tag beside the live status — JOINED, CASUAL, LOCKED. */
const StateTag = ({ label, icon }: { label: string; icon?: boolean }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: radius.xs,
        borderWidth: 1,
        borderColor: c.hair2,
      }}>
      {icon ? <LockIcon size={10} color={c.mute2} /> : null}
      <Text style={[type.eyebrow, { fontSize: 9.5, letterSpacing: em(0.14, 9.5), color: c.mute2 }]}>
        {label}
      </Text>
    </View>
  );
};

const SectionHead = ({ label, right }: { label: string; right: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Text style={[type.eyebrow, { color: c.mute2 }]}>{label}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>{right}</Text>
    </View>
  );
};

const address = 'Lot D rooftop, Charles E Young Dr, Los Angeles';

/** Precise-location map card shown once you're in the room. */
const RoomMap = () => {
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
        <View>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: c.ink }}>
            Lot D rooftop, level 5
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.mute }}>
            Charles E Young Dr · 4 min walk
          </Text>
        </View>
        <TextButton
          label="Directions"
          onPress={() => Linking.openURL(`http://maps.apple.com/?q=${encodeURIComponent(address)}`)}
          style={{ fontFamily: font.medium, fontSize: 12.5, color: c.blue }}
        />
      </View>
    </MapPlate>
  );
};

const Footer = ({
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

/** Live room, member view. `avatarsShown` / `roomSize` mirror the design props. */
export function Room({
  avatarsShown = 6,
  roomSize = 14,
  hostUpdate = "On the roof by the stairwell door — text me if the badge reader is being weird",
}: {
  avatarsShown?: number;
  roomSize?: number;
  hostUpdate?: string;
}) {
  const { c } = useTheme();
  const { go, reset } = useNav();
  const shown = Math.max(1, Math.min(roster.length, avatarsShown));
  const members = roster.slice(0, shown);
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <StatusLine label="LIVE · 22M" color={c.green} pulse />
            <StateTag label="JOINED" />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}>
        <View>
          <Text style={[type.displayLg, { color: c.ink }]}>Sunset set on Lot D roof</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            Hosted by Maya J · '27, Architecture
          </Text>
        </View>

        <RoomMap />

        <View>
          <View style={{ marginBottom: 14 }}>
            <SectionHead label="WHO'S HERE" right={`${roomSize} here now`} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {members.map((m) => (
              <AvatarCell
                key={m.initials}
                initials={m.initials}
                name={m.name}
                host={m.host}
                onPress={() => go('profile')}
              />
            ))}
            <SlotCell badge={`+${Math.max(0, roomSize - shown)}`} label="more" />
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <Text style={[type.eyebrow, { color: c.mute2 }]}>HOST UPDATES</Text>
          <NoteItem text={hostUpdate} meta="Maya J · 2 min ago" accent={c.green} />
          <NoteItem
            text="Room opened — bring a layer, it's windy up here"
            meta="22 min ago"
            muted
          />
        </View>
      </Body>

      <Footer>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
          <LockIcon color={c.mute2} />
          <Text
            style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, lineHeight: 12.5 * 1.4 }}>
            Only Maya posts updates.{'\n'}You'll get a ping for each one.
          </Text>
        </View>
        <TextButton
          label="Leave room"
          onPress={() => reset('discover')}
          style={{ fontFamily: font.regular, fontSize: 13, color: c.danger }}
        />
      </Footer>
    </View>
  );
}

/** Live room, host view — stats, roster, and the host-only composer. */
export function RoomHost() {
  const { c } = useTheme();
  const { go, reset } = useNav();
  const [draft, setDraft] = useState('Moving to the east ledge — better view');
  const [updates, setUpdates] = useState([
    {
      text: 'On the roof by the stairwell door — text me if the badge reader is being weird',
      meta: 'You · 2 min ago · seen by 12',
    },
    {
      text: "Room opened — bring a layer, it's windy up here",
      meta: 'You · 22 min ago · seen by 14',
    },
  ]);
  const post = () => {
    const text = draft.trim();
    if (!text) return;
    setUpdates((u) => [{ text, meta: 'You · just now · seen by 0' }, ...u]);
    setDraft('');
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <StatusLine label="LIVE · 22M" color={c.green} pulse />
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 9,
                borderRadius: radius.xs,
                backgroundColor: c.coral,
              }}>
              <Text
                style={[type.eyebrow, { fontSize: 9.5, letterSpacing: em(0.14, 9.5), color: c.onCoral }]}>
                YOU'RE HOSTING
              </Text>
            </View>
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 20 }}>
        <View>
          <Text style={[type.display, { color: c.ink }]}>Sunset set on Lot D roof</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            You're hosting · 14 joined · cap 18
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
          {[
            { n: '14', label: 'HERE NOW' },
            { n: '4', label: 'ON THE WAY' },
          ].map((s) => (
            <View key={s.label}>
              <Text style={{ fontFamily: font.bold, fontSize: 19, color: c.ink }}>{s.n}</Text>
              <Text
                style={{
                  fontFamily: font.regular,
                  fontSize: 11,
                  letterSpacing: em(0.1, 11),
                  color: c.mute2,
                }}>
                {s.label}
              </Text>
            </View>
          ))}
          <View style={{ marginLeft: 'auto', alignSelf: 'center', flexDirection: 'row', gap: 8 }}>
            <Chip
              label="Share"
              style={{ paddingVertical: 6 }}
              onPress={() =>
                Share.share({ message: 'Sunset set on Lot D roof — open seat on openseat' })
              }
            />
            <Chip
              label="End room"
              color={c.danger}
              style={{ paddingVertical: 6 }}
              onPress={() => reset('roomCanceled')}
            />
          </View>
        </View>

        <View>
          <View style={{ marginBottom: 12 }}>
            <SectionHead label="WHO'S HERE" right="14 here now" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <AvatarCell initials="MJ" name="You" host onPress={() => go('profileEmpty')} />
            <AvatarCell initials="AT" name="Ade" onPress={() => go('profile')} />
            <AvatarCell initials="RK" name="Ro" onPress={() => go('profile')} />
            <AvatarCell initials="SP" name="Sam" onPress={() => go('profile')} />
            <AvatarCell initials="DL" name="Dee" onPress={() => go('profile')} />
            <SlotCell badge="+9" label="more" />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Text style={[type.eyebrow, { color: c.mute2 }]}>YOUR UPDATES</Text>
          {updates.map((u, i) => (
            <NoteItem
              key={u.meta + i}
              text={u.text}
              meta={u.meta}
              accent={i === 0 ? c.green : undefined}
              muted={i > 0}
            />
          ))}
        </View>
      </Body>

      <Footer raised column gap={11}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[type.eyebrow, { color: c.green }]}>POST AN UPDATE · HOST ONLY</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11.5, color: c.faint }}>Pings all 14</Text>
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Tell the room something"
          placeholderTextColor={c.faint}
          selectionColor={c.coral}
          onSubmitEditing={post}
          style={{
            minHeight: 52,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: c.ink,
            backgroundColor: c.surface,
            fontFamily: font.regular,
            fontSize: 14,
            lineHeight: 14 * 1.45,
            color: c.ink,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>
            Members can't post here
          </Text>
          <PrimaryButton
            label="Post update"
            height={38}
            onPress={post}
            style={{ paddingHorizontal: 20, borderRadius: radius.md }}
          />
        </View>
      </Footer>
    </View>
  );
}

/** Locked room, host view — the approve/decline queue. */
export function RoomHostRequests() {
  const { c } = useTheme();
  const { go } = useNav();
  const [requests, setRequests] = useState([
    { initials: 'NB', name: 'Nia B.', sub: "'28 · Design | Media Arts", tone: 'fill' as const },
    { initials: 'TV', name: 'Theo V.', sub: "'27 · Materials Science", tone: 'park' as const },
    { initials: 'EM', name: 'Emi M.', sub: "'29 · Undeclared", tone: 'water' as const },
  ]);
  const [approved, setApproved] = useState<{ initials: string; name: string }[]>([]);
  const cap = 8;
  const here = 5 + approved.length;
  const decide = (initials: string, approve: boolean) => {
    const r = requests.find((q) => q.initials === initials);
    if (!r) return;
    setRequests((v) => v.filter((q) => q.initials !== initials));
    if (approve) setApproved((v) => [...v, { initials: r.initials, name: r.name.split(' ')[0] }]);
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <StatusLine label="LIVE · 12M" color={c.green} pulse />
            <StateTag label="LOCKED" icon />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 20 }}>
        <View>
          <Text style={[type.display, { color: c.ink }]}>Studio night, 8 people max</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            You're hosting · {here} joined · cap {cap} · you approve each request
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
            <StatusLine
              label={`JOIN REQUESTS · ${requests.length}`}
              color={requests.length ? c.coral : c.mute2}
              outline={!requests.length}
            />
            <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.mute }}>
              {cap - here} seats left
            </Text>
          </View>
          {requests.length === 0 ? (
            <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute, paddingTop: 14 }}>
              Nobody's waiting. New requests land here.
            </Text>
          ) : null}
          {requests.map((r, i) => (
            <View
              key={r.initials}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                borderBottomWidth: i === requests.length - 1 ? 0 : 1,
                borderBottomColor: c.hairFaint,
              }}>
              <Avatar initials={r.initials} tone={r.tone} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.medium, fontSize: 14.5, color: c.ink }}>{r.name}</Text>
                <Text
                  style={{ fontFamily: font.regular, fontSize: 12, color: c.mute, marginTop: 2 }}>
                  {r.sub}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextButton
                  label="Decline"
                  onPress={() => decide(r.initials, false)}
                  style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Approve ${r.name}`}
                  onPress={() => decide(r.initials, true)}
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
          ))}
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: c.faint, marginTop: 12 }}>
            Requests close when the room ends. Nobody sees the address until you approve.
          </Text>
        </View>

        <View>
          <View style={{ marginBottom: 12 }}>
            <SectionHead label="WHO'S HERE" right={`${here} approved`} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <AvatarCell initials="MJ" name="You" host onPress={() => go('profileEmpty')} />
            <AvatarCell initials="AT" name="Ade" onPress={() => go('profile')} />
            <AvatarCell initials="RK" name="Ro" onPress={() => go('profile')} />
            <AvatarCell initials="SP" name="Sam" onPress={() => go('profile')} />
            <AvatarCell initials="DL" name="Dee" onPress={() => go('profile')} />
            {approved.map((a) => (
              <AvatarCell
                key={a.initials}
                initials={a.initials}
                name={a.name}
                onPress={() => go('profile')}
              />
            ))}
            <SlotCell badge={`${cap - here}`} label="open" />
          </View>
        </View>
      </Body>

      <Footer>
        <Text
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
          Only you post{'\n'}updates here
        </Text>
        <PrimaryButton label="Post an update" onPress={() => go('roomHost')} style={{ flex: 1 }} />
      </Footer>
    </View>
  );
}

/**
 * Casual room before joining. Small rooms keep their pin private — the map
 * shows an approximate area until you're in.
 */
export function RoomCasualPreJoin() {
  const { c } = useTheme();
  const { go } = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <StatusLine label="TONIGHT · 7:30 PM" color={c.blue} />
            <StateTag label="CASUAL" />
          </View>
        }
      />
      <Body contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}>
        <View>
          <Text style={[type.displayLg, { color: c.ink }]}>Grab dinner, whoever's around</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            Ade T · '28, Econ · 2 of 4 seats
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
              Near Westwood
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
                Approximate area · about a 10 min walk
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
            <SectionHead label="WHO'S GOING" right="2 going" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <AvatarCell initials="AT" name="Ade" host onPress={() => go('profile')} />
            <AvatarCell initials="JC" name="Jos" tone="water" onPress={() => go('profile')} />
            <SlotCell label="open" />
            <SlotCell label="open" />
          </View>
        </View>

        <View style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: c.hair }}>
          <Text style={[type.eyebrow, { color: c.mute2 }]}>FROM ADE</Text>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14.5,
              lineHeight: 14.5 * 1.5,
              color: c.ink2,
              marginTop: 8,
            }}>
            Somewhere cheap on Broxton, then whoever's still up can walk over to the ceramics thing.
          </Text>
        </View>
      </Body>

      <Footer>
        <Text
          style={{ fontFamily: font.regular, fontSize: 12, color: c.mute2, lineHeight: 12 * 1.4 }}>
          Address unlocks{'\n'}after you join
        </Text>
        {/* Joining is what reveals the exact pin — the joined room is that view. */}
        <PrimaryButton
          label="Join · 2 seats left"
          onPress={() => go('room')}
          style={{ flex: 1 }}
        />
      </Footer>
    </View>
  );
}

/** Host called it off. No push, no alert colour — you only meet this on open. */
export function RoomCanceled() {
  const { c } = useTheme();
  const { reset, go } = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <RoomTopBar
        muted
        center={<StatusLine label="CANCELED" color={c.mute2} outline />}
      />
      <Body
        contentStyle={{ paddingHorizontal: 22, paddingBottom: 6, gap: 24, flexGrow: 1 }}>
        <View>
          <Text style={[type.display, { color: c.ink2 }]}>Maya called off the sunset set.</Text>
          <Text
            style={{
              fontFamily: font.regular,
              fontSize: 14,
              lineHeight: 14 * 1.55,
              color: c.mute,
              marginTop: 10,
              maxWidth: 302,
            }}>
            Nothing's happening at Lot D tonight. You're off the list — no need to tell anyone.
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
          <Text style={[type.eyebrow, { color: c.mute2 }]}>WAS SET FOR</Text>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 18,
              letterSpacing: em(-0.018, 18),
              color: c.ink2,
            }}>
            Sunset set on Lot D roof
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute }}>
            Tonight, 7:15 PM · Lot D rooftop · 14 had joined
          </Text>
        </View>

        <View style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: c.hair }}>
          <Text style={[type.eyebrow, { color: c.mute2 }]}>MAYA'S LAST NOTE</Text>
          <View style={{ marginTop: 12 }}>
            <NoteItem
              text="Roof access got locked for the night — sorry. Trying again Sunday if the weather holds."
              meta="Maya J · 40 min ago"
              muted
            />
          </View>
        </View>

        <View
          style={{
            marginTop: 'auto',
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: c.hair,
            gap: 14,
          }}>
          <Text style={[type.eyebrow, { color: c.mute2 }]}>STILL LIVE NEARBY</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hedrick lounge, bad movie"
            onPress={() => go('room')}>
            <StatusLine label="LIVE · 22M" color={c.green} small />
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 17,
                letterSpacing: em(-0.018, 17),
                color: c.ink,
                marginTop: 6,
              }}>
              Hedrick lounge, bad movie
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute, marginTop: 3 }}>
              Hedrick Hall, floor 1 · 3 min · 9 here
            </Text>
          </Pressable>
        </View>
      </Body>

      <Footer column gap={12}>
        <PrimaryButton label="Back to Discover" onPress={() => reset('discover')} />
        <Text
          style={{ fontFamily: font.regular, fontSize: 12.5, color: c.faint, textAlign: 'center' }}>
          This room is closed for good
        </Text>
      </Footer>
    </View>
  );
}
