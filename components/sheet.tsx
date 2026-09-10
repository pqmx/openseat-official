import { useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  type FlatList,
  type ListRenderItem,
  StyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type AnimatedRef,
  SnappySpringConfig,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { nearestSnap } from '../snap';
import { radius, useTheme } from '../theme';
import type { Room } from '../data';

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
};

/** Controlled snap positions. Header drags move the sheet; list drags yield at the top. */
export const BottomSheet = ({
  index,
  onIndexChange,
  detents,
  listRef,
  header,
  children,
  contentStyle,
  data,
  renderItem,
  footer,
  refreshing,
  onRefresh,
}: {
  index: number;
  onIndexChange: (i: number) => void;
  /** Fraction of the container visible at each stop, most closed first. */
  detents: number[];
  /** The caller's, so it can scroll the list to a selection. */
  listRef: AnimatedRef<FlatList<Room>>;
  /** Always visible; the drag handle sits above it. */
  header: React.ReactNode;
  children?: React.ReactNode;
  data: Room[];
  renderItem: ListRenderItem<Room>;
  footer?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) => {
  const { c } = useTheme();
  const [height, setHeight] = useState(0);

  const snaps = useMemo(() => detents.map((f) => Math.round(height * (1 - f))), [detents, height]);

  const y = useSharedValue(0);
  const start = useSharedValue(0);
  /** Latched per gesture: once the sheet starts moving it keeps moving. */
  const moving = useSharedValue(false);
  /** Skips the opening animation the first time we know how tall we are. */
  const placed = useSharedValue(false);
  const scrolled = useScrollOffset(listRef);

  const open = snaps.length ? snaps[snaps.length - 1] : 0;
  const shut = snaps.length ? snaps[0] : 0;

  const settled = height > 0;
  useEffect(() => {
    if (!settled) return;
    const to = snaps[clamp(index, 0, snaps.length - 1)];
    if (placed.value) {
      y.value = withSpring(to, SnappySpringConfig);
    } else {
      y.value = to;
      placed.value = true;
    }
  }, [index, settled, snaps, y, placed]);

  const release = (velocity: number) => {
    'worklet';
    const i = nearestSnap(y.value, snaps, velocity);
    y.value = withSpring(snaps[i], SnappySpringConfig);
    scheduleOnRN(onIndexChange, i);
  };

  const headerPan = Gesture.Pan()
    .onBegin(() => {
      start.value = y.value;
    })
    .onChange((e) => {
      y.value = clamp(start.value + e.translationY, open, shut);
    })
    .onEnd((e) => release(e.velocityY));

  const listPan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    // Without this the ScrollView's native gesture wins every vertical drag
    // and the sheet never moves from the list. The cast is only a type gap:
    // gesture-handler wants a ref to a component, Reanimated's animated ref
    // holds the instance, and the runtime takes either.
    .simultaneousWithExternalGesture(listRef as unknown as React.RefObject<React.ComponentType>)
    .onBegin(() => {
      moving.value = false;
    })
    .onChange((e) => {
      if (!moving.value) {
        // The list gets the gesture until it has nothing left to give: only a
        // downward drag with the list already at its top moves the sheet.
        const atTop = scrolled.value <= 0;
        if (!atTop || e.changeY < 0) return;
        moving.value = true;
      }
      y.value = clamp(y.value + e.changeY, open, shut);
    })
    .onEnd((e) => {
      if (moving.value) release(e.velocityY);
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], height: Math.max(0, height - y.value) }));

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      {height === 0 ? null : (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height,
              backgroundColor: c.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              borderTopWidth: 1,
              borderColor: c.frame,
              boxShadow: `0px -6px 18px ${c.shadowCol}`,
            },
            slide,
          ]}>
          <GestureDetector gesture={headerPan}>
            <View accessible={false}>
              <View
                accessibilityRole="adjustable"
                accessibilityLabel="Room list"
                accessibilityHint="Swipe up or down to resize the list"
                accessibilityValue={{ min: 0, max: detents.length - 1, now: index }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) =>
                  onIndexChange(
                    clamp(
                      index + (e.nativeEvent.actionName === 'increment' ? 1 : -1),
                      0,
                      detents.length - 1
                    )
                  )
                }
                style={{ paddingTop: 10, paddingBottom: 4, alignItems: 'center' }}>
                <View
                  style={{
                    width: 38,
                    height: 4,
                    borderRadius: radius.round,
                    backgroundColor: c.hair2,
                  }}
                />
              </View>
              {header}
            </View>
          </GestureDetector>

          <GestureDetector gesture={listPan}>
            <Animated.FlatList<Room>
              ref={listRef}
              data={data}
              renderItem={renderItem}
              keyExtractor={(room) => room.id}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              ListEmptyComponent={<View>{children}</View>}
              ListFooterComponent={footer}
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              // The sheet reads the top of the list to decide who gets the
              // drag; a rubber-banding list would lie about being there.
              bounces={false}
              overScrollMode="never"
              scrollEnabled={index > 0}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={contentStyle}
            />
          </GestureDetector>
        </Animated.View>
      )}
    </View>
  );
};
