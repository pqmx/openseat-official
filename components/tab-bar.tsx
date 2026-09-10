import { Pressable, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, useTheme } from '../theme';
import { ClockIcon, HomeIcon, PersonIcon, PlusIcon } from './icons';

/** App tabs; the active slot follows the current route. */
export const TabBar = () => {
  const { c } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const path = usePathname();
  const active = path.startsWith('/rooms') ? 'rooms' : path.startsWith('/discover') ? 'discover' : 'you';
  const slot = (
    label: string,
    selected: boolean,
    icon: React.ReactNode,
    onPress: () => void
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', gap: 5 }}>
      <View style={{ height: 28, justifyContent: 'center' }}>{icon}</View>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: 10,
          color: selected ? c.ink : c.faint,
        }}>
        {label}
      </Text>
    </Pressable>
  );
  const tint = (t: string) => (t === active ? c.ink : c.faint);
  return (
    <View
      style={{
        minHeight: 56 + bottom,
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.hair,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: Math.max(bottom, 8),
      }}>
      {slot('Discover', active === 'discover', <HomeIcon color={tint('discover')} />, () =>
        router.navigate('/discover')
      )}
      {slot('Rooms', active === 'rooms', <ClockIcon color={tint('rooms')} />, () =>
        router.navigate('/rooms')
      )}
      {slot(
        'New',
        false,
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.chip,
            backgroundColor: c.coral,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <PlusIcon size={16} color={c.onCoral} />
        </View>,
        () => router.push('/create')
      )}
      {slot('You', active === 'you', <PersonIcon color={tint('you')} />, () =>
        router.navigate('/you')
      )}
    </View>
  );
};
