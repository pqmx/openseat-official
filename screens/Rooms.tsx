import { Text, View } from 'react-native';
import { RoomList } from '../components/rooms';
import { Body, Eyebrow, PrimaryButton, StatusStrip } from '../components/ui';
import { isHost, isLive, myRooms, useNow } from '../data';
import { router } from 'expo-router';
import { font, type, useTheme } from '../theme';

/** The Rooms tab — what you're hosting and what you've joined. */
export function Rooms() {
  const { c } = useTheme();
  const now = useNow();
  const mine = myRooms(now);
  const hosting = mine.filter((r) => isHost(r));
  const joined = mine.filter((r) => !isHost(r));
  const live = mine.filter((r) => isLive(r, now));
  const later = mine.filter((r) => !isLive(r, now));

  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <StatusStrip />
      <Body contentStyle={{ paddingTop: 8, paddingHorizontal: 22, paddingBottom: 24, gap: 26, flexGrow: 1 }}>
        <View>
          <Text style={[type.display, { color: c.ink }]}>Your rooms</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 13, color: c.mute, marginTop: 8 }}>
            {mine.length
              ? [
                  live.length ? `${live.length} live now` : null,
                  later.length ? `${later.length} coming up` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : "Nothing yet — open one and see who's around"}
          </Text>
        </View>

        {hosting.length ? (
          <View style={{ gap: 14 }}>
            <Eyebrow>YOU'RE HOSTING</Eyebrow>
            <RoomList items={hosting} now={now} />
          </View>
        ) : null}

        {joined.length ? (
          <View style={{ gap: 14, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.hair }}>
            <Eyebrow>YOU'VE JOINED</Eyebrow>
            <RoomList items={joined} now={now} />
          </View>
        ) : null}

        <View style={{ marginTop: 'auto', paddingTop: 20 }}>
          <PrimaryButton label="Open a room" onPress={() => router.push('/create')} />
        </View>
      </Body>
    </View>
  );
}
