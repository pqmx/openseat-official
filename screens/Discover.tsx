import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  SnappySpringConfig,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { RoomCard, RoomRow, RoomStatus } from '../components/rooms';
import { BottomSheet } from '../components/sheet';
import { Dot, Eyebrow, MapPlate, MapSearchBar, PrimaryButton } from '../components/ui';
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

/** How much of the sheet's container is showing at each stop. */
const detents = [0.12, 0.55, 0.92];
const HALF = 1;

/**
 * A pin. Selected, it names its room; otherwise it's a bare dot, so at most
 * one label is ever competing with the map.
 */
const MapPin = ({
  room,
  selected,
  left,
  top,
  onPress,
}: {
  room: Room;
  selected: boolean;
  left: number;
  top: number;
  onPress: () => void;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={room.title}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={10}
      style={{ position: 'absolute', left: left - 5, top: top - 8 }}>
      {selected ? (
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
      ) : (
        <Dot color={c.blue} size={9} />
      )}
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
 * The plate, full-bleed behind the sheet. `pan` is the closest thing this
 * screen has to a camera: selecting a pin springs the plate so that pin sits
 * in the open area above the sheet. Nothing resets it, so collapsing the sheet
 * leaves the view exactly where it was.
 */
const Map = ({
  live,
  selectedId,
  onSelect,
  dimmed,
  pan,
}: {
  live: Room[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  dimmed?: boolean;
  pan: { x: SharedValue<number>; y: SharedValue<number> };
}) => {
  const { c } = useTheme();
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: pan.x.value }, { translateY: pan.y.value }],
  }));
  return (
    <MapPlate cellW={100} cellH={120} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, drift]}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 246,
            width: 210,
            height: 170,
            backgroundColor: c.park,
          }}
        />
        <View
          style={{ position: 'absolute', left: -30, top: 118, width: 460, height: 14, backgroundColor: c.water }}
        />
        {dimmed ? null : (
          <>
            <MapLabel text="the quad" color={c.parkLabel} left={24} top={322} />
            <MapLabel text="sunset canyon" color={c.waterLabel} left={216} top={126} />
          </>
        )}
        {live.slice(0, pinSpots.length).map((room, i) => (
          <MapPin
            key={room.id}
            room={room}
            selected={room.id === selectedId}
            onPress={() => onSelect(room.id)}
            {...pinSpots[i]}
          />
        ))}
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
      </Animated.View>
      <MapSearchBar />
    </MapPlate>
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
  const rowY = useRef<Record<string, number>>({});
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);

  const feed = feedFor(viewerYear, now);
  const live = feed.filter((r) => isLive(r, now));
  const upcoming = feed.filter((r) => !isLive(r, now));
  const shown = filterFeed(feed, tab, now);

  /** Springs the plate so `room`'s pin lands in the open area above the sheet. */
  const center = useCallback(
    (id: string) => {
      const at = live.findIndex((r) => r.id === id);
      if (at < 0 || at >= pinSpots.length) return;
      const spot = pinSpots[at];
      panX.value = withSpring(180 - spot.left, SnappySpringConfig);
      panY.value = withSpring(150 - spot.top, SnappySpringConfig);
    },
    [live, panX, panY]
  );

  /** A pin: select it, open the sheet to half, and bring its row into view. */
  const fromPin = useCallback(
    (id: string) => {
      setSelectedId(id);
      setIndex(HALF);
      center(id);
      const y = rowY.current[id];
      if (y !== undefined) listRef.current?.scrollTo({ y, animated: true });
    },
    [center, listRef]
  );

  /**
   * A row: the first tap selects and centres, the second opens the room. One
   * tap can't both move the map and navigate away from it. A room with no pin
   * — anything in Tonight or This week — has nothing to centre on, so it skips
   * straight to opening rather than charging a tap for no visible change.
   */
  const fromRow = useCallback(
    (id: string) => {
      const at = live.findIndex((r) => r.id === id);
      const pinned = at >= 0 && at < pinSpots.length;
      if (selectedId === id || !pinned) {
        router.push(`/room/${id}`);
        return;
      }
      setSelectedId(id);
      center(id);
    },
    [center, live, selectedId]
  );

  if (live.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.surface }}>
        <Map live={[]} selectedId={null} onSelect={fromPin} dimmed pan={{ x: panX, y: panY }} />
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
      <Map
        live={live}
        selectedId={selectedId}
        onSelect={fromPin}
        pan={{ x: panX, y: panY }}
      />
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
