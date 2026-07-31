import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { RoomCard, RoomRow, RoomStatus } from '../components/rooms';
import { BottomSheet } from '../components/sheet';
import { Dot, Eyebrow, MapSearchBar, PrimaryButton } from '../components/ui';
import { feedFor, isLive, useNow, you, type Room } from '../data';
import { router } from 'expo-router';
import { em, font, radius, type, useTheme } from '../theme';

/** How much of the sheet's container is showing at each stop. */
const detents = [0.12, 0.55, 0.92];
const HALF = 1;

/**
 * Westwood, framed so the campus rooms and the village rooms both land on
 * screen. Only the opening shot — after that the camera is the map's own.
 */
const westwood: Region = {
  latitude: 34.0686,
  longitude: -118.4465,
  latitudeDelta: 0.022,
  longitudeDelta: 0.016,
};

/** Tight enough to read a building, wide enough to keep its neighbours. */
const closeDelta = { latitudeDelta: 0.006, longitudeDelta: 0.005 };

/**
 * A pin. Selected, it names its room; otherwise it's a bare dot, so at most
 * one label is ever competing with the map.
 */
const MapPin = ({
  room,
  selected,
  onPress,
}: {
  room: Room;
  selected: boolean;
  onPress: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Marker
      coordinate={{ latitude: room.lat, longitude: room.lng }}
      // The label sits to the right of the dot, so the dot — not the middle of
      // the whole row — is what lands on the coordinate.
      anchor={selected ? { x: 0.12, y: 0.5 } : { x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
      onPress={onPress}
      accessibilityLabel={room.title}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6 }}
        accessible
        accessibilityState={{ selected }}>
        <Dot color={selected ? c.green : c.blue} size={selected ? 14 : 11} glow={selected ? c.greenGlow : undefined} />
        {selected ? (
          <View
            style={{
              gap: 1,
              paddingVertical: 5,
              paddingHorizontal: 9,
              borderRadius: radius.chip,
              backgroundColor: c.surface94,
              borderWidth: 1,
              borderColor: c.frame,
            }}>
            <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.ink }}>
              {room.title.split(',')[0]}
            </Text>
            <Text style={{ fontFamily: font.regular, fontSize: 11, color: c.mute }}>
              {room.attendees.length} here
            </Text>
          </View>
        ) : null}
      </View>
    </Marker>
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

/**
 * The map, full-bleed behind the sheet. It owns its own camera — nothing here
 * writes a region back to it after the first frame, so panning and zooming
 * survive everything the sheet does, and the sheet survives everything the map
 * does. `mapRef` is the screen's only handle, used to fly to a pin.
 */
const Map = ({
  live,
  selectedId,
  onSelect,
  mapRef,
}: {
  live: Room[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mapRef: React.RefObject<MapView | null>;
}) => (
  <View style={StyleSheet.absoluteFill}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={westwood}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      /*
       * Without this the map centres behind the sheet and every pin sits in
       * the covered half. Padding tells it the usable viewport is the band
       * above the half-open sheet, which is where centring and the opening
       * frame both aim. It's a constant on purpose — following the sheet
       * would re-render the map mid-drag and shove the camera around.
       */
      mapPadding={{ top: 0, right: 0, bottom: 380, left: 0 }}>
      {live.map((room) => (
        <MapPin
          key={room.id}
          room={room}
          selected={room.id === selectedId}
          onPress={() => onSelect(room.id)}
        />
      ))}
    </MapView>
    <MapSearchBar />
  </View>
);

/**
 * One room in the sheet. `box-only` is the point: `RoomCard` and `RoomRow` are
 * themselves Pressables that push straight to the room, so without it the
 * inner press wins and the first tap can never mean "show me this on the map".
 * The children still render identically, they just stop being touch targets.
 */
const FeedItem = ({
  room,
  selected,
  onPress,
  onLayout,
  style,
  children,
}: {
  room: Room;
  selected: boolean;
  onPress: () => void;
  onLayout: (y: number) => void;
  style?: ViewStyle;
  children: React.ReactNode;
}) => (
  <View style={style} onLayout={(e) => onLayout(e.nativeEvent.layout.y)}>
    <Pressable
      pointerEvents="box-only"
      accessibilityRole="button"
      accessibilityLabel={room.title}
      accessibilityHint={selected ? 'Opens the room' : 'Shows this room on the map'}
      accessibilityState={{ selected }}
      onPress={onPress}>
      {children}
    </Pressable>
  </View>
);

/**
 * Discover. The '29 view isn't a separate screen — restricted rooms are
 * simply absent from `feedFor`, so the map, the list and the count all drop
 * them together. No grey cards, no lock icons.
 *
 * The sheet's stop and the map's offset are separate state that never write to
 * each other: panning the map can't move the sheet, and moving the sheet can't
 * lose the map's position.
 */
export function Discover({ viewerYear = you.year }: { viewerYear?: string }) {
  const { c } = useTheme();
  const now = useNow();
  const [tab, setTab] = useState('Live');
  const [index, setIndex] = useState(HALF);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listRef = useAnimatedRef<Animated.ScrollView>();
  const mapRef = useRef<MapView | null>(null);
  const rowY = useRef<Record<string, number>>({});

  const feed = feedFor(viewerYear, now);
  const live = feed.filter((r) => isLive(r, now));
  const upcoming = feed.filter((r) => !isLive(r, now));
  const shown = filterFeed(feed, tab, now);

  /** Flies the camera to a room's pin; `mapPadding` keeps it clear of the sheet. */
  const center = useCallback((room: Room) => {
    mapRef.current?.animateToRegion(
      { latitude: room.lat, longitude: room.lng, ...closeDelta },
      380
    );
  }, []);

  /** A pin: select it, open the sheet to half, and bring its row into view. */
  const fromPin = useCallback(
    (id: string) => {
      const room = live.find((r) => r.id === id);
      if (!room) return;
      setSelectedId(id);
      setIndex(HALF);
      center(room);
      const y = rowY.current[id];
      if (y !== undefined) listRef.current?.scrollTo({ y, animated: true });
    },
    [center, listRef, live]
  );

  /**
   * A row: the first tap selects and centres, the second opens the room. One
   * tap can't both move the map and navigate away from it. A room with no pin
   * — anything in Tonight or This week — has nothing to centre on, so it skips
   * straight to opening rather than charging a tap for no visible change.
   */
  const fromRow = useCallback(
    (id: string) => {
      const room = live.find((r) => r.id === id);
      if (selectedId === id || !room) {
        router.push(`/room/${id}`);
        return;
      }
      setSelectedId(id);
      center(room);
    },
    [center, live, selectedId]
  );

  if (live.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <Map live={[]} selectedId={null} onSelect={fromPin} mapRef={mapRef} />
        <BottomSheet
          index={index}
          onIndexChange={setIndex}
          detents={detents}
          listRef={listRef}
          header={
            <View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 }}>
              <RoomStatus status={{ label: 'NOTHING LIVE WITHIN 15 MIN', tone: 'off' }} />
            </View>
          }
          contentStyle={{ paddingHorizontal: 22, paddingBottom: 24, gap: 22 }}>
          <View>
            <Text
              style={[
                type.display,
                { fontSize: 24, lineHeight: 24 * 1.2, letterSpacing: em(-0.022, 24), color: c.ink },
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
        </BottomSheet>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <Map live={live} selectedId={selectedId} onSelect={fromPin} mapRef={mapRef} />
      <BottomSheet
        index={index}
        onIndexChange={setIndex}
        detents={detents}
        listRef={listRef}
        header={
          <View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14, gap: 14 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
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
          </View>
        }
        contentStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 }}>
        {shown.length === 0 ? (
          <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
            Nothing in this window. Try another.
          </Text>
        ) : (
          // One wrapper per room, all siblings, so every `onLayout` reports an
          // offset in the same coordinate space and `scrollTo` can use it.
          <View style={{ gap: 16 }}>
            {shown.map((room, i) => (
              <FeedItem
                key={room.id}
                room={room}
                selected={room.id === selectedId}
                onPress={() => fromRow(room.id)}
                onLayout={(y) => {
                  rowY.current[room.id] = y;
                }}
                style={
                  i === 0 || i === shown.length - 1
                    ? undefined
                    : { paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: c.hair }
                }>
                {/* The nearest room leads with the full card. */}
                {i === 0 ? <RoomCard room={room} now={now} /> : <RoomRow room={room} now={now} />}
              </FeedItem>
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}
