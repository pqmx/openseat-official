import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { RoomCard, RoomPreview, RoomRow, RoomStatus } from '../components/rooms';
import { BottomSheet } from '../components/sheet';
import { Eyebrow, MapFilterButton, PrimaryButton, Toggle } from '../components/ui';
import { useNow } from '../api';
import {
  feedFor,
  isLive,
  matchesQuery,
  showsExactPin,
  type Person,
  type Query,
  type Room,
} from '../data';
import { router } from 'expo-router';
import { em, font, radius, type, useTheme } from '../theme';

/** How much of the sheet's container is showing at each stop. */
const detents = [0.12, 0.55, 0.92];
const HALF = 1;

/** Initial map region; subsequent camera movements belong to the user. */
const westwood: Region = {
  latitude: 34.0686,
  longitude: -118.4465,
  latitudeDelta: 0.022,
  longitudeDelta: 0.016,
};

/** Tight enough to read a building, wide enough to keep its neighbours. */
const closeDelta = { latitudeDelta: 0.006, longitudeDelta: 0.005 };

/** Marker dimensions keep the dot anchored to its coordinate when labels change. */
const PIN = { dot: 15, dotSelected: 26, pad: 8, gap: 3, line: 13, cardLine: 15 };

/** Fraction down the marker view where the dot's centre sits. */
const anchorY = (height: number, dot: number) => (PIN.pad + dot / 2) / height;

/** Selected pins show a card; other pins show a compact label. */
const MapPin = ({
  room,
  selected,
  onPress,
}: {
  // Only ever rendered behind `showsExactPin`, which narrows the coordinates
  // to plain numbers — a room without a pin can't reach this component.
  room: Room & { lat: number; lng: number };
  selected: boolean;
  onPress: () => void;
}) => {
  const { c } = useTheme();
  const dot = selected ? PIN.dotSelected : PIN.dot;
  const label = selected ? PIN.cardLine + PIN.line + 12 : PIN.line;
  const height = PIN.pad + dot + PIN.gap + label + PIN.pad;
  return (
    <Marker
      coordinate={{ latitude: room.lat, longitude: room.lng }}
      // The label hangs below the dot and is centred on it, so x is always the
      // middle however long the room's name runs.
      anchor={{ x: 0.5, y: anchorY(height, dot) }}
      zIndex={selected ? 2 : 1}
      onPress={onPress}
      accessibilityLabel={room.title}>
      <View
        // Room to draw the shadow — a marker view clips to its own bounds.
        style={{ alignItems: 'center', gap: PIN.gap, padding: PIN.pad }}
        accessible
        accessibilityState={{ selected }}>
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: radius.round,
            backgroundColor: selected ? c.green : c.blue,
            // The white collar is what reads as an Apple annotation: it holds
            // the dot off whatever it's sitting on, so a pin over a park and a
            // pin over a road are equally legible.
            borderWidth: selected ? 3 : 2.5,
            borderColor: c.raised,
            boxShadow: `0px 1px 4px ${c.shadowCol}`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {selected ? (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: radius.round,
                backgroundColor: c.raised,
              }}
            />
          ) : null}
        </View>
        {selected ? (
          <View
            style={{
              gap: 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: radius.chip,
              backgroundColor: c.raised,
              boxShadow: `0px 1px 4px ${c.shadowCol}`,
            }}>
            <Text
              style={{ fontFamily: font.medium, fontSize: 12.5, lineHeight: PIN.cardLine, color: c.ink }}>
              {room.title.split(',')[0]}
            </Text>
            <Text
              style={{ fontFamily: font.regular, fontSize: 11, lineHeight: PIN.line, color: c.mute }}>
              {room.attendees.length} here
            </Text>
          </View>
        ) : (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: font.medium,
              fontSize: 10.5,
              lineHeight: PIN.line,
              color: c.ink2,
              maxWidth: 104,
              // A halo rather than a plate: the name sits on the map instead of
              // on top of it, which is the difference between four labels and
              // four more things covering the streets.
              textShadowColor: c.raised,
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 0 },
            }}>
            {room.title.split(',')[0]}
          </Text>
        )}
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

/** Seat filter. FeedTabs owns the time window. */
const Filters = ({
  query,
  onChange,
  onClose,
}: {
  query: Query;
  onChange: (q: Query) => void;
  onClose: () => void;
}) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 110,
        left: 20,
        right: 20,
        padding: 16,
        gap: 14,
        borderRadius: radius.card,
        backgroundColor: c.surface94,
        borderWidth: 1,
        borderColor: c.frame,
        boxShadow: `0px 4px 16px ${c.shadowCol}`,
      }}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Only rooms with a seat"
        accessibilityState={{ checked: !!query.openOnly }}
        onPress={() => onChange({ ...query, openOnly: !query.openOnly })}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.ink }}>
          Only rooms with a seat
        </Text>
        {/** The row owns accessibility and taps; the nested toggle is decorative. */}
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <Toggle on={!!query.openOnly} />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear filters" onPress={() => onChange({})}>
          <Text style={{ fontFamily: font.regular, fontSize: 12.5, color: c.mute }}>Clear</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose}>
          <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.coral }}>Done</Text>
        </Pressable>
      </View>
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
  onClear,
  mapRef,
}: {
  live: Room[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  mapRef: React.RefObject<MapView | null>;
}) => {
  const { c } = useTheme();
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={westwood}
      /*
       * Tapping the map itself puts the preview away — but a tap on one of our
       * marker views bubbles up to the map too, so without the guard selecting
       * a pin immediately deselected it. The camera still flew, which made it
       * look like the preview simply never opened.
       */
      onPress={(e) => {
        if (e.nativeEvent.action !== 'marker-press') onClear();
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      /*
       * Apple's own place pins — every storefront on Broxton — compete with the
       * room pins and win, because there are fifty of them. Streets, parks and
       * buildings stay; the commercial clutter goes. Note the trailing "s":
       * react-native-maps spells this one `showsPointsOfInterests`.
       */
      showsPointsOfInterests={false}
      /*
       * Without this the map centres behind the sheet and every pin sits in
       * the covered half. Padding tells it the usable viewport is the band
       * above the half-open sheet, which is where centring and the opening
       * frame both aim. It's a constant on purpose — following the sheet
       * would re-render the map mid-drag and shove the camera around.
       */
      mapPadding={{ top: 0, right: 0, bottom: 380, left: 0 }}>
      {live.map((room) =>
        showsExactPin(room) ? (
          <MapPin
            key={room.id}
            room={room}
            selected={room.id === selectedId}
            onPress={() => onSelect(room.id)}
          />
        ) : (
          /*
           * A room whose exact pin the server withheld is discoverable but not
           * findable. The circle is drawn from the coarse coordinate every
           * viewer gets — rounded to ~110m, inside a 150m circle — so the room
           * still appears; only the address is missing.
           *
           * `room_pins_select` currently sends a pin to everyone who can see the
           * room, so nothing reaches this branch today. It stays because the
           * absence is a real state: `room_pins` has no constraint requiring a
           * row, and `showsExactPin` is the only sanctioned way to ask. Drawing
           * a marker at `undefined` is the alternative.
           */
          <Circle
            key={room.id}
            center={{ latitude: room.approxLat, longitude: room.approxLng }}
            radius={150}
            strokeColor={c.blue}
            strokeWidth={1}
            fillColor={c.greenGlow}
          />
        )
      )}
    </MapView>
  );
};

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
  children,
}: {
  room: Room;
  selected: boolean;
  onPress: () => void;
  onLayout: (y: number) => void;
  children: React.ReactNode;
}) => (
  <View onLayout={(e) => onLayout(e.nativeEvent.layout.y)}>
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
export function Discover({
  rooms,
  me,
  viewerYear = me.year,
}: {
  rooms: Room[];
  me: Person;
  viewerYear?: string;
}) {
  const { c } = useTheme();
  const now = useNow();
  const [tab, setTab] = useState('Live');
  const [index, setIndex] = useState(HALF);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState<Query>({});
  const [showFilters, setShowFilters] = useState(false);
  /**
   * Also the answer to "is an empty feed something you did, or a quiet night?"
   * — the filter panel is the only way to narrow the feed now, so the two
   * questions have the same answer and no longer need two names.
   */
  const narrowed = !!query.openOnly;

  const listRef = useAnimatedRef<Animated.ScrollView>();
  const mapRef = useRef<MapView | null>(null);
  const rowY = useRef<Record<string, number>>({});

  // The query narrows everything at once — map pins, the count and the list —
  // so the map can never show a room the list is hiding.
  const feed = feedFor(rooms, viewerYear, now).filter((r) => matchesQuery(r, query));
  const live = feed.filter((r) => isLive(r, now));
  const upcoming = feed.filter((r) => !isLive(r, now));
  const shown = filterFeed(feed, tab, now);
  // Derived, not stored: a selected room that drops out of the feed — it ends,
  // or the year filter changes — stops being selected on its own.
  const selected = live.find((r) => r.id === selectedId) ?? null;

  const clear = useCallback(() => setSelectedId(null), []);

  /** Flies the camera to a room's pin; `mapPadding` keeps it clear of the sheet. */
  const center = useCallback((room: Room) => {
    // Falls back to the coarse coordinate when the server withheld the pin —
    // the camera can still fly to the circle, just not to the door.
    mapRef.current?.animateToRegion(
      {
        latitude: room.lat ?? room.approxLat,
        longitude: room.lng ?? room.approxLng,
        ...closeDelta,
      },
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
   * A row: select it, and let the preview do the talking. This used to open the
   * room on a second tap, which meant the first tap cost you something and told
   * you nothing. Now one tap answers the question and the preview's button is
   * the only thing that navigates.
   */
  const fromRow = useCallback(
    (id: string) => {
      const room = live.find((r) => r.id === id);
      // Nothing in Tonight or This week has a pin to fly to, so those go
      // straight through to the room rather than selecting nothing visible.
      if (!room) {
        router.push(`/room/${id}`);
        return;
      }
      setSelectedId(id);
      center(room);
    },
    [center, live]
  );

  // Nothing live is a state of the same screen, not a screen of its own — the
  // map, the controls and the sheet are identical either way, only the header
  // and what's inside the sheet change.
  const empty = live.length === 0;

  const header = empty ? (
    <View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 }}>
      <RoomStatus status={{ label: narrowed ? 'NOTHING MATCHES' : 'NOTHING LIVE', tone: 'off' }} />
    </View>
  ) : selected ? (
    // Selected, the header names the room instead of counting rooms —
    // the count is what you needed before you picked one.
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 22,
        paddingTop: 6,
        paddingBottom: 14,
      }}>
      {/* Named the place, not a distance — there is no measured one. */}
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: font.regular, fontSize: 12.5, color: c.mute2 }}>
        {selected.place}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to all rooms"
        hitSlop={12}
        onPress={clear}>
        <Text style={{ fontFamily: font.medium, fontSize: 12.5, color: c.coral }}>All rooms</Text>
      </Pressable>
    </View>
  ) : (
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
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <Map
        live={live}
        selectedId={selectedId}
        onSelect={fromPin}
        onClear={clear}
        mapRef={mapRef}
      />
      <MapFilterButton filtersOn={narrowed} onFilters={() => setShowFilters((v) => !v)} />
      {showFilters ? (
        <Filters query={query} onChange={setQuery} onClose={() => setShowFilters(false)} />
      ) : null}
      <BottomSheet
        index={index}
        onIndexChange={setIndex}
        detents={detents}
        listRef={listRef}
        header={header}
        contentStyle={
          empty
            ? { paddingHorizontal: 22, paddingBottom: 24, gap: 22 }
            : { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 }
        }>
        {empty ? (
          <>
            <View>
              <Text
                style={[
                  type.display,
                  { fontSize: 24, lineHeight: 24 * 1.2, letterSpacing: em(-0.022, 24), color: c.ink },
                ]}>
                {/* An empty result you caused reads differently from a quiet night. */}
                {narrowed ? 'No rooms match\nthose filters.' : 'Quiet out there.'}
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
                {narrowed
                  ? 'Every room nearby is full. Clear the filter to see them, or open one of your own.'
                  : 'A blanket and a speaker is a room — takes about forty seconds.'}
              </Text>
            </View>

            {narrowed ? (
              <PrimaryButton label="Clear filters" onPress={() => setQuery({})} />
            ) : (
              <PrimaryButton label="Open a room" onPress={() => router.push('/create')} />
            )}

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
          </>
        ) : selected ? (
          <RoomPreview room={selected} now={now} />
        ) : shown.length === 0 ? (
          <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
            Nothing in this window. Try another.
          </Text>
        ) : (
          // One wrapper per room, all siblings, so every `onLayout` reports an
          // offset in the same coordinate space and `scrollTo` can use it.
          <View style={{ gap: 16 }}>
            {shown.map((room) => (
              <FeedItem
                key={room.id}
                room={room}
                selected={room.id === selectedId}
                onPress={() => fromRow(room.id)}
                onLayout={(y) => {
                  rowY.current[room.id] = y;
                }}>
                <RoomCard room={room} now={now} />
              </FeedItem>
            ))}
          </View>
        )}
      </BottomSheet>
    </View>
  );
}
