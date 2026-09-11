import { ActivityIndicator, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, useTheme } from '../theme';
import { TextButton } from './controls';

/** Reserve the device’s top safe-area inset. */
export const StatusStrip = () => {
  const { top } = useSafeAreaInsets();
  return <View style={{ height: top }} />;
};

/** The bar under the fold: a hairline rule, then the screen's actions. */
export const Footer = ({
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
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: 14,
        paddingHorizontal: 22,
        paddingBottom: Math.max(bottom, 14),
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

/** Body region of a screen — scrolls where the mock simply clipped. */
export const Body = ({
  children,
  style,
  contentStyle,
  keyboardAware,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Allow taps on results while the keyboard is open. */
  keyboardAware?: boolean;
}) => (
  <ScrollView
    style={[{ flex: 1 }, style]}
    contentContainerStyle={contentStyle}
    // Dismiss on scroll; profile changes stay in the explicit-save draft.
    keyboardDismissMode="on-drag"
    keyboardShouldPersistTaps={keyboardAware ? 'handled' : undefined}
    // iOS only. Android resizes already, from Expo's default layout mode.
    automaticallyAdjustKeyboardInsets
    showsVerticalScrollIndicator={false}>
    {children}
  </ScrollView>
);

/** Network status stays beside usable content; first loads have a visible placeholder. */
export const LoadState = ({ loading, error, retry }: { loading?: boolean; error?: unknown; retry: () => void }) => {
  const { c } = useTheme();
  if (!loading && !error) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ padding: 16, gap: 8, backgroundColor: c.surface }}>
      {loading ? <ActivityIndicator accessibilityLabel="Loading rooms" color={c.coral} /> : null}
      {error ? <>
        <Text style={{ color: c.mute, fontFamily: font.regular }}>Couldn't refresh. Previously loaded information may be out of date.</Text>
        <TextButton label="Retry" onPress={retry} style={{ color: c.coral }} />
      </> : null}
    </View>
  );
};
