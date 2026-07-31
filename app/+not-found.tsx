import { Stack } from 'expo-router';
import { NotFound } from '../screens/NotFound';

export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <NotFound />
    </>
  );
}
