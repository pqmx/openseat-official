import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// A missing key fails as an opaque "Invalid API key" on the first query, three
// screens away from the cause. Say it here instead.
if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and fill it in, then restart Metro with --clear.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no URL carrying a session on native. Leaving this on makes the
    // client wait for a redirect that never arrives.
    detectSessionInUrl: false,
  },
});

// Refreshing on a timer while the app is backgrounded burns tokens and fails
// silently; tie it to foreground instead, as the React Native guide does.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
