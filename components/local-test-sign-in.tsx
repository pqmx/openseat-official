import { canUseLocalTestAccount, LOCAL_TEST_ACCOUNT } from '../local-test-config';
import { supabase } from '../supabase';
import { PrimaryButton } from './controls';

export const LocalTestSignIn = ({ busy, go }: {
  busy: boolean;
  go: (run: () => Promise<void>) => () => Promise<void>;
}) => {
  if (!canUseLocalTestAccount(__DEV__, process.env.EXPO_PUBLIC_LOCAL_TEST_AUTH, process.env.EXPO_PUBLIC_SUPABASE_URL)) return null;
  const signIn = async () => {
    if (!canUseLocalTestAccount(__DEV__, process.env.EXPO_PUBLIC_LOCAL_TEST_AUTH, process.env.EXPO_PUBLIC_SUPABASE_URL)) {
      throw new Error('Local test sign-in is disabled.');
    }
    const { error } = await supabase.auth.signInWithPassword(LOCAL_TEST_ACCOUNT);
    if (error) throw error;
  };
  return <PrimaryButton label="Use local test account" disabled={busy} onPress={go(signIn)} />;
};
