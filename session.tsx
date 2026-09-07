import { GoogleSignin } from '@react-native-google-signin/google-signin';
import type { Session } from '@supabase/supabase-js';
import * as Apple from 'expo-apple-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { deleteAccount as deleteAccountRow, fetchPerson } from './api';
import type { Person } from './data';
import { supabase } from './supabase';

/**
 * An error whose message was written *for* the student — the only kind a screen
 * may show verbatim. Everything else reaching a `catch` is a provider string, a
 * Postgres error or a network failure, none of which mean anything to them.
 */
export class Refusal extends Error {}

// Supabase verifies provider tokens. Database triggers enforce campus email
// membership; profile names cannot be changed through client column grants.

GoogleSignin.configure({
  // Supabase verifies the token's audience, and the audience of a token minted
  // on iOS is the *iOS* client — so both IDs have to be listed as authorised
  // client IDs in the dashboard, not just the web one that holds the secret.
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  // No `hostedDomain`: it takes one domain and UCLA has two. The trigger holds
  // the rule instead, the same way it did when this was a typed-in address.
});

const UCLA = /@(g\.)?ucla\.edu$/i;

/** The `email` claim, read straight out of an unverified identity token.
 *
 *  This is for the message, never for the decision — `handle_new_user()` is
 *  what refuses, and it sees a token Supabase has actually verified. The reason
 *  to look is that GoTrue reports a trigger failure on the ID-token path as an
 *  opaque `Database error saving new user`, and for Apple the refusal is the
 *  common case rather than the odd one: most students' Apple IDs are personal,
 *  and Hide My Email hands over `@privaterelay.appleid.com`. Worth six lines to
 *  say which address it was. */
const emailIn = (token: string): string | undefined => {
  try {
    const body = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!body) return undefined;
    const email = JSON.parse(atob(body)).email;
    return typeof email === 'string' ? email : undefined;
  } catch {
    return undefined;
  }
};

export type SessionValue = {
  session: Session | null;
  /** The signed-in student's profile row, or null while signed out. */
  me: Person | null;
  /** Why the profile didn't load. Distinct from `me === null`, which means the
   *  row genuinely isn't there — the gate reports the wrong cause without it. */
  error: Error | null;
  loading: boolean;
  /** Nothing an account signs in with carries a class year, so a fresh one has
   *  this until onboarding sets it. */
  needsOnboarding: boolean;
  signInWithGoogle: () => Promise<void>;
  /** iOS only — `Apple.isAvailableAsync()` is false everywhere else. */
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Ends the account for good. Signs out on the way, because there is no
   *  session left to hold once `auth.users` has lost the row. */
  deleteAccount: () => Promise<void>;
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
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const userId = useRef<string | undefined>(undefined);

  const loadPerson = useCallback(async (id: string | undefined) => {
    if (id !== userId.current) return;
    const request = ++generation.current;
    if (!id) {
      setMe(null);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const person = await fetchPerson(id);
      if (request !== generation.current) return;
      setMe(person ?? null);
      setError(null);
    } catch (e) {
      if (request !== generation.current) return;
      setMe(null);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // INITIAL_SESSION already supplies the stored session. A second getSession
    // races it, and fetching inside this callback can contend on the auth lock.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (userId.current === s?.user.id) return;
      userId.current = s?.user.id;
      ++generation.current;
      setMe(null);
      setError(null);
      setLoading(!!s);
    });
    return () => { ++generation.current; data.subscription.unsubscribe(); };
  }, []);

  const sessionUserId = session?.user.id;
  useEffect(() => {
    void loadPerson(sessionUserId);
    // Token refresh changes the session object, but does not change the profile.
  }, [sessionUserId, loadPerson]);

  const reloadMe = useCallback(() => loadPerson(sessionUserId), [loadPerson, sessionUserId]);

  // No state to set on success in either of these: `onAuthStateChange` above is
  // already subscribed, so the session and the profile land through the same
  // path a token refresh uses. Setting them here too would just be a second,
  // racing copy of that.
  const signInWithGoogle = useCallback(async () => {
    const res = await GoogleSignin.signIn();
    // Cancelling is a response, not a rejection, in v13 and up — returning
    // quietly is what leaves the gate exactly as the student left it.
    if (res.type !== 'success') return;
    const token = res.data.idToken;
    if (!token) throw new Error('Google signed in without an ID token.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) throw error;
  }, []);

  const signInWithApple = useCallback(async () => {
    let credential: Apple.AppleAuthenticationCredential;
    try {
      // EMAIL only. `FULL_NAME` was here to feed the handover below, which is
      // gone — asking for a name we now discard is a row on Apple's sheet that
      // buys the student nothing.
      credential = await Apple.signInAsync({
        requestedScopes: [Apple.AppleAuthenticationScope.EMAIL],
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      throw e;
    }

    const token = credential.identityToken;
    if (!token) throw new Error('Apple signed in without an identity token.');

    // Read off the token rather than `credential.email`, which Apple fills in
    // on the first authorisation only — including the retry after a refusal,
    // which is precisely when this needs to say something useful.
    const email = emailIn(token);
    if (email && !UCLA.test(email)) {
      throw new Refusal(
        email.endsWith('@privaterelay.appleid.com')
          ? 'Hide My Email is on, so Apple gave us a relay address. Openseat needs your UCLA email — turn it off for Openseat, or continue with Google.'
          : `Your Apple ID uses ${email}. Openseat needs your UCLA email — continue with Google instead.`,
      );
    }

    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token });
    if (error) throw error;

  }, []);

  const signOut = useCallback(async () => {
    // Google caches the last account natively: without this, "Continue with
    // Google" silently signs the same person back in and the chooser never
    // appears — wrong on any shared device.
    await GoogleSignin.signOut().catch(() => {});
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setMe(null);
  }, []);

  // Order matters: the RPC needs a live session to know who it is deleting, and
  // signing out first would leave it with no `auth.uid()` and nothing to do.
  const deleteAccount = useCallback(async () => {
    await deleteAccountRow();
    await signOut();
  }, [signOut]);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      me,
      error,
      loading,
      // The feed is year-gated in the database, so a profile without one
      // sees almost nothing. Onboarding is load-bearing, not decorative.
      needsOnboarding: !!session && !!me && !me.year,
      signInWithGoogle,
      signInWithApple,
      signOut,
      deleteAccount,
      reloadMe,
    }),
    [session, me, error, loading, signInWithGoogle, signInWithApple, signOut, deleteAccount, reloadMe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
