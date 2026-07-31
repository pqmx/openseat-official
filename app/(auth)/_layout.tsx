import { Stack } from 'expo-router';

/** Sign-in and profile setup: no headers, the screens draw their own chrome. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
