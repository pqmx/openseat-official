import * as Haptics from 'expo-haptics';
import { useCallback, useState, useRef } from 'react';
import { Alert } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { UserError, errorMessage } from './errors';

/** Haptic failures must not fail a successful operation. */
export const tapOk = () =>
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const tapFail = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

/** Prevent duplicate writes and report failures at the point of interaction. */
export const useWrite = () => {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (locked.current) return false;
      locked.current = true;
      setBusy(true);
      try {
        await fn();
        tapOk();
        return true;
      } catch (error) {
        tapFail();
        if (!(error instanceof UserError)) Sentry.captureException(error, { tags: { operation: 'user-write' } });
        Alert.alert("That didn't work", errorMessage(error));
        return false;
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [],
  );
  return { busy, run };
};
