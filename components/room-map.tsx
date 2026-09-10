import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { mapsUrl, showsExactPin, type MapsApp, type Room as RoomModel } from '../data';
import { getMapsApp, setMapsApp } from '../prefs';
import { useWrite } from '../feedback';
import { font, radius, useTheme } from '../theme';
import { Dot } from './ui';

/** Map preview and directions through the user's preferred maps app. */
export const RoomMap = ({ room }: { room: RoomModel }) => {
  const { c } = useTheme();
  // The coordinates the plate draws are the same ones `mapsUrl` hands off, so
  // the picture and the link can't disagree about where the room is.
  const exact = showsExactPin(room);
  const lat = exact ? room.lat : room.approxLat;
  const lng = exact ? room.lng : room.approxLng;
  const { run } = useWrite();
  const pick = (app: MapsApp) => {
    void setMapsApp(app);
    void run(() => Linking.openURL(mapsUrl(room, app)));
  };

  const openMaps = async () => {
    const saved = await getMapsApp();
    if (saved) return void run(() => Linking.openURL(mapsUrl(room, saved)));
    Alert.alert(
      room.place,
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
      {/** Let the surrounding button receive map taps. */}
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
          /** Show an area, not a precise marker, for fallback coordinates. */
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
