import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { font, type, useTheme } from '../theme';

export default function NotFound() {
  const { c } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, backgroundColor: c.surface, justifyContent: 'center', padding: 22, gap: 12 }}>
        <Text style={[type.display, { color: c.ink }]}>No room at that address.</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}>
          The link may be old, or the host closed it.
        </Text>
        <Link href="/discover" style={{ fontFamily: font.medium, fontSize: 14, color: c.coral, marginTop: 4 }}>
          Back to Discover
        </Link>
      </View>
    </>
  );
}
