import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoomCard, RoomRow, RoomStatus } from '../components/rooms';
import { Body, Dot, Eyebrow, MapPlate, MapSearchBar, PrimaryButton } from '../components/ui';
import { feedFor, isLive, useNow, you, type Room } from '../data';
import { router } from 'expo-router';
import { em, font, radius, type, useTheme } from '../theme';

const MapLabel = ({ text, color, left, top }: { text: string; color: string; left: number; top: number }) => (
  <Text
    style={{
      position: 'absolute',
      left,
      top,
      fontFamily: font.regular,
      fontSize: 10,
      letterSpacing: em(0.18, 10),
      textTransform: 'uppercase',
      color,
    }}>
    {text}
  </Text>
);

/** Pins are laid out by hand — the plate is decorative, not a real map. */
const pinSpots = [
  { left: 154, top: 206 },
  { left: 262, top: 166 },
  { left: 72, top: 142 },
  { left: 104, top: 236 },
  { left: 296, top: 288 },
];

/** The named pin: a glowing dot with the room beside it. */
const MapPin = ({
  room,
  now,
  left,
  top,
}: {
  room: Room;
  now: Date;
  left: number;
  top: number;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={room.title}
      onPress={() => router.push(`/room/${room.id}`)}
      style={{ position: 'absolute', left: left - 5, top: top - 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Dot color={c.green} size={14} glow={c.greenGlow} />
        <View style={{ gap: 1 }}>
          <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.ink }}>
            {room.title.split(',')[0]}
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.mute }}>
            {room.attendees.length} here
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const FeedTabs = ({ active, onChange }: { active: string; onChange: (t: string) => void }) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: c.hair,
        paddingBottom: 10,
        marginTop: -8,
      }}>
      {['Live', 'Tonight', 'This week'].map((t) => (
        <Pressable
          key={t}
          accessibilityRole="button"
          accessibilityState={{ selected: t === active }}
          onPress={() => onChange(t)}>
          <Text
            style={
              t === active
                ? {
                    fontFamily: font.medium,
                    fontSize: 12.5,
                    color: c.ink,
                    borderBottomWidth: 1.5,
                    borderBottomColor: c.ink,
                    paddingBottom: 9,
                    marginBottom: -11,
                  }
                : { fontFamily: font.regular, fontSize: 12.5, color: c.mute2 }
            }>
            {t}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

/** Same day as `now`, so "Tonight" means tonight. */
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const filterFeed = (feed: Room[], tab: string, now: Date) => {
  if (tab === 'Live') return feed;
  if (tab === 'Tonight') return feed.filter((r) => isLive(r, now) || sameDay(r.startsAt, now));
  return feed.filter((r) => !isLive(r, now));
};

const Map = ({ live, now, dimmed }: { live: Room[]; now: Date; dimmed?: boolean }) => {
  const { c } = useTheme();
  return (
    <MapPlate cellW={100} cellH={120} style={{ height: dimmed ? 300 : 352 }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: dimmed ? 210 : 246,
          width: 210,
          height: dimmed ? 150 : 170,
          backgroundColor: c.park,
        }}
      />
      <View
        style={{ position: 'absolute', left: -30, top: dimmed ? 112 : 118, width: 460, height: 14, backgroundColor: c.water }}
      />
      {dimmed ? null : (
        <>
          <MapLabel text="the quad" color={c.parkLabel} left={24} top={322} />
          <MapLabel text="sunset canyon" color={c.waterLabel} left={216} top={126} />
        </>
      )}
      {/* The nearest room gets the named pin; the rest are bare dots. */}
      {live.slice(0, pinSpots.length).map((room, i) =>
        i === 0 ? (
          <MapPin key={room.id} room={room} now={now} {...pinSpots[0]} />
        ) : (
          <View key={room.id} style={{ position: 'absolute', ...pinSpots[i] }}>
            <Dot color={c.blue} size={9} />
          </View>
        )
      )}
      {dimmed ? (
        <>
          <View
            style={{
              position: 'absolute',
              left: 139,
              top: 170,
              width: 70,
              height: 70,
              borderRadius: radius.round,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: c.dash,
            }}
          />
          <View style={{ position: 'absolute', left: 166, top: 197 }}>
            <Dot color={c.dotMute} size={14} outline />
          </View>
        </>
      ) : null}
      <MapSearchBar />
    </MapPlate>
  );
};

/**
 * Discover. The '29 view isn't a separate screen — restricted rooms are
 * simply absent from `feedFor`, so the map, the list and the count all drop
 * them together. No grey cards, no lock icons.
 */
export function Discover({ viewerYear = you.year }: { viewerYear?: string }) {
  const { c } = useTheme();
  const now = useNow();
  const [tab, setTab] = useState('Live');

  const feed = feedFor(viewerYear, now);
  const live = feed.filter((r) => isLive(r, now));
  const upcoming = feed.filter((r) => !isLive(r, now));
  const shown = filterFeed(feed, tab, now);

  if (live.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <Map live={[]} now={now} dimmed />
        <Body
          style={{ borderTopWidth: 1, borderTopColor: c.frame }}
          contentStyle={{ paddingTop: 26, paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}>
          <View>
            <RoomStatus status={{ label: 'NOTHING LIVE WITHIN 15 MIN', tone: 'off' }} />
            <Text
              style={[
                type.display,
                { fontSize: 24, lineHeight: 24 * 1.2, letterSpacing: em(-0.022, 24), color: c.ink, marginTop: 12 },
              ]}>
              Quiet out there.{'\n'}Tuesdays usually are.
            </Text>
            <Text
              style={{
                fontFamily: font.regular,
                fontSize: 14,
                lineHeight: 14 * 1.55,
                color: c.mute,
                marginTop: 10,
                maxWidth: 300,
              }}>
              31 rooms opened near campus last week. A blanket and a speaker is a room — takes about
              forty seconds.
            </Text>
          </View>

          <PrimaryButton label="Open a room" onPress={() => router.push('/create')} />

          {upcoming.length ? (
            <View style={{ gap: 14, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.hair }}>
              <Eyebrow>LATER THIS WEEK</Eyebrow>
              {upcoming.slice(0, 3).map((room, i) => (
                <View
                  key={room.id}
                  style={
                    i === 0
                      ? undefined
                      : { paddingTop: 14, borderTopWidth: 1, borderTopColor: c.hairFaint }
                  }>
                  <RoomRow room={room} now={now} small />
                </View>
              ))}
            </View>
          ) : null}
        </Body>
      </View>
    );
  }

  const [hero, ...rest] = shown;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <Map live={live} now={now} />
      <Body
        style={{ borderTopWidth: 1, borderTopColor: c.frame }}
        contentStyle={{ paddingTop: 18, paddingHorizontal: 22, paddingBottom: 24, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 17,
              letterSpacing: em(-0.015, 17),
              color: c.ink,
            }}>
            {live.length} {live.length === 1 ? 'room' : 'rooms'} live nearby
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute2 }}>
            {now.getHours() >= 17 ? 'Tonight' : 'Today'}
          </Text>
        </View>

        <FeedTabs active={tab} onChange={setTab} />

        {shown.length === 0 ? (
          <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
            Nothing in this window. Try another.
          </Text>
        ) : (
          <View style={{ gap: 16 }}>
            <RoomCard room={hero} now={now} />
            {rest.map((room, i) => (
              <View
                key={room.id}
                style={
                  i === rest.length - 1
                    ? undefined
                    : { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.hair }
                }>
                <RoomRow room={room} now={now} />
              </View>
            ))}
          </View>
        )}
      </Body>
    </View>
  );
}
