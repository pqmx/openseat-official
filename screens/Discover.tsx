import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import { useAnimatedRef } from 'react-native-reanimated';
import { RoomCard, RoomPreview } from '../components/rooms';
import { BottomSheet } from '../components/sheet';
import { LoadState } from '../components/layout';
import { MapFilterButton } from '../components/map-filter-button';
import { PrimaryButton, Toggle } from '../components/controls';
import { useNow, useRoom, useRooms } from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FeedWindow } from '../room-rules';
import {
  attendeeCountOf,
  filterFeed,
  matchesQuery,
  showsExactPin,
  type Query,
  type Room,
} from '../data';
import { router } from 'expo-router';
import { font, radius, type, useTheme } from '../theme';

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
              {attendeeCountOf(room)} joined
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

const FeedTabs = ({ active, onChange }: { active: FeedWindow; onChange: (t: FeedWindow) => void }) => {
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
      {(['Live', 'Tonight', 'This week'] as const).map((t) => (
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
  const { top } = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        top: top + 60,
        zIndex: 5,
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

/** Map props remain stable when only relative-time labels tick. */
const Map = memo(function Map({ rooms, selectedId, onSelect, onClear, mapRef, bottom }: {
  rooms: Room[]; selectedId: string | null; onSelect: (id: string) => void;
  onClear: () => void; mapRef: React.RefObject<MapView | null>; bottom: number;
}) {
  return <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={westwood}
    onPress={(e) => { if (e.nativeEvent.action !== 'marker-press') onClear(); }}
    showsUserLocation={false} showsMyLocationButton={false} showsCompass={false}
    toolbarEnabled={false} showsPointsOfInterests={false}
    mapPadding={{ top: 0, right: 0, bottom, left: 0 }}>
    {rooms.map((room) => showsExactPin(room)
      ? <MapPin key={room.id} room={room} selected={room.id === selectedId} onPress={() => onSelect(room.id)} />
      : <Circle key={room.id} center={{ latitude: room.approxLat, longitude: room.approxLng }}
          radius={150} strokeColor="#57758D" fillColor="rgba(70,130,100,0.15)" />)}
  </MapView>;
});

const SelectedPreview = ({ id }: { id: string }) => {
  const { room, loading, error, reload } = useRoom(id);
  const now = useNow();
  return <View>
    <LoadState loading={loading} error={error} retry={reload} />
    {room ? <RoomPreview room={room} now={now} /> : !loading && !error ? <Text>This room is no longer available.</Text> : null}
  </View>;
};

export function Discover() {
  const { c } = useTheme();
  const now = useNow();
  const [tab, setTab] = useState<FeedWindow>('Live');
  const [index, setIndex] = useState(HALF);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState<Query>({});
  const [showFilters, setShowFilters] = useState(false);
  const { rooms, loading, refreshing, error, reload, hasMore, loadMore } = useRooms({ window: tab, openOnly: query.openOnly });
  const listRef = useAnimatedRef<FlatList<Room>>();
  const mapRef = useRef<MapView | null>(null);
  const { height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const shown = filterFeed(rooms, tab, now).filter((room) => matchesQuery(room, query));
  const visibleIds = shown.map((room) => room.id).join(',');
  const mapRooms = useMemo(() => {
    const ids = new Set(visibleIds.split(','));
    return rooms.filter((room) => ids.has(room.id));
  }, [rooms, visibleIds]);
  const selected = shown.find((room) => room.id === selectedId);
  const clear = useCallback(() => setSelectedId(null), []);
  const select = useCallback((id: string) => {
    const room = rooms.find((r) => r.id === id);
    if (!room) return;
    setSelectedId(id);
    setIndex(HALF);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    mapRef.current?.animateToRegion({ latitude: room.lat ?? room.approxLat,
      longitude: room.lng ?? room.approxLng, ...closeDelta }, 380);
  }, [rooms, listRef]);
  const renderItem = useCallback(({ item }: { item: Room }) => (
    <View style={{ paddingBottom: 16 }}><RoomCard room={item} now={now} onOpen={() => select(item.id)} /></View>
  ), [now, select]);
  const changeTab = (next: FeedWindow) => {
    clear(); setTab(next); listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  return <View style={{ flex: 1, backgroundColor: c.surface }}>
    <Map rooms={mapRooms} selectedId={selected?.id ?? null} onSelect={select} onClear={clear}
      mapRef={mapRef} bottom={Math.round((height - top - bottom - 56) * 0.55)} />
    <BottomSheet index={index} onIndexChange={setIndex} detents={detents} listRef={listRef}
      data={selected ? [] : shown} renderItem={renderItem}
      refreshing={refreshing && !loading} onRefresh={reload}
      header={<View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[type.cardTitle, { color: c.ink }]}>{selected ? 'Room details' : tab === 'Live' ? 'Live rooms' : tab}</Text>
          {selected ? <Pressable accessibilityRole="button" onPress={clear}><Text style={{ color: c.coral }}>All rooms</Text></Pressable> : null}
        </View>
        <FeedTabs active={tab} onChange={changeTab} />
        <LoadState loading={loading} error={error} retry={reload} />
      </View>}
      contentStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}
      footer={!selected && hasMore ? <PrimaryButton label={refreshing ? 'Loading…' : 'Load more rooms'} disabled={refreshing} onPress={loadMore} /> : null}>
      {selected ? <SelectedPreview id={selected.id} /> : !loading && !error ? <View style={{ gap: 16 }}>
        <Text style={[type.display, { color: c.ink }]}>No rooms in this window.</Text>
        <Text style={{ fontFamily: font.regular, color: c.mute }}>
          {query.openOnly ? 'Try another time window or turn off the seat filter.' : 'Try another time window, or open a room.'}
        </Text>
        {query.openOnly ? <PrimaryButton label="Clear filters" onPress={() => setQuery({})} /> : null}
        {tab === 'Live' ? <PrimaryButton label="See upcoming rooms" onPress={() => changeTab('This week')} /> : null}
        <PrimaryButton label="Open a room" onPress={() => router.push('/create')} />
      </View> : null}
    </BottomSheet>
    <MapFilterButton filtersOn={!!query.openOnly} expanded={showFilters} onFilters={() => setShowFilters((v) => !v)} />
    {showFilters ? <Filters query={query} onChange={(next) => { clear(); setQuery(next); }} onClose={() => setShowFilters(false)} /> : null}
  </View>;
}
