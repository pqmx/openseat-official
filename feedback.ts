import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

/** Haptic failures must not fail a successful operation. */
export const tapOk = () =>
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const tapFail = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

/** Prevent duplicate writes and report failures at the point of interaction. */
export const useWrite = () => {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (busy) return false;
      setBusy(true);
      try {
        await fn();
        tapOk();
        return true;
      } catch {
        // Most failures here are a policy refusing a write, and its message is
        // a Postgres string. "Try again" is the honest version of that.
        tapFail();
        Alert.alert("That didn't work", 'Try again in a moment.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  return { busy, run };
};
