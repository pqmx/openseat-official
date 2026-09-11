import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, useTheme } from '../theme';
import { FilterIcon } from './icons';

/** Floating filter button over the map. */
export const MapFilterButton = ({
  filtersOn,
  onFilters,
  expanded,
}: {
  /** Dot on the button when the feed is narrowed. */
  filtersOn?: boolean;
  onFilters: () => void;
  expanded?: boolean;
}) => {
  const { c } = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Filters"
      accessibilityState={{ expanded: !!expanded }}
      onPress={onFilters}
      style={{
        position: 'absolute',
        top: top + 10,
        right: 20,
        width: 42,
        height: 42,
        borderRadius: radius.md,
        backgroundColor: c.surface94,
        borderWidth: 1,
        borderColor: filtersOn ? c.ink : c.frame,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <FilterIcon color={c.ink2} />
      {filtersOn ? (
        <View
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: radius.round,
            backgroundColor: c.coral,
          }}
        />
      ) : null}
    </Pressable>
  );
};
