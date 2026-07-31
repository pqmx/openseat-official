import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPerson } from './api';
import type { Person } from './data';
import { supabase } from './supabase';

/**
 * Who the app is for. Identity used to be `export const you = people[0]`, which
 * a real session can't be: it is wrong before sign-in, wrong after sign-out,
 * and wrong for the second account on a shared device. Screens take a `Person`
 * now, and this is where it comes from.
 */

/** Both are real UCLA addresses; the signup trigger enforces the same rule. */
export const UCLA_EMAIL = /@(g\.)?ucla\.edu$/i;

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const hostedDomain = process.env.EXPO_PUBLIC_GOOGLE_HOSTED_DOMAIN;

GoogleSignin.configure({
  // Supabase verifies the ID token against the *web* client, even on iOS.
  webClientId,
  iosClientId,
  // UCLA issues both @ucla.edu and @g.ucla.edu, and this accepts only one
  // domain, so it stays opt-in. The database trigger is the enforcement.
  ...(hostedDomain ? { hostedDomain } : {}),
  scopes: ['profile', 'email'],
});

export type SessionValue = {
  session: Session | null;
  /** The signed-in student's profile row, or null while signed out. */
  me: Person | null;
  loading: boolean;
  /** Google returns no year, so a fresh account has one until onboarding. */
  needsOnboarding: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  reloadMe: () => Promise<void>;
};

const Ctx = createContext<SessionValue | undefined>(undefined);

export const useSession = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
};

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const reloadMe = useCallback(async () => {
    if (!session) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe((await fetchPerson(session.user.id)) ?? null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    setLoading(true);
    reloadMe();
  }, [reloadMe]);

  const signIn = useCallback(async () => {
    if (!webClientId || !iosClientId) {
      throw new Error(
        'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID / EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. ' +
          'Create them in the Google Cloud console, then restart Metro with --clear.',
      );
    }

    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return; // the sheet was dismissed

    const { idToken, user } = res.data;
    if (!idToken) throw new Error('Google returned no ID token.');

    // Checked here purely so a non-UCLA student gets a sentence instead of the
    // opaque 500 a trigger exception surfaces as. The trigger still decides.
    if (!UCLA_EMAIL.test(user.email ?? '')) {
      await GoogleSignin.signOut();
      throw new Error(`Openseat is UCLA-only. ${user.email} isn't a UCLA account.`);
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Otherwise the next sign-in silently reuses the same Google account.
    await GoogleSignin.signOut().catch(() => {});
    setMe(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        me,
        loading,
        // The feed is year-gated in the database, so a profile without one
        // sees almost nothing. Onboarding is load-bearing, not decorative.
        needsOnboarding: !!session && !!me && !me.year,
        signIn,
        signOut,
        reloadMe,
      }}>
      {children}
    </Ctx.Provider>
  );
};
