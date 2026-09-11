import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { canUseLocalTestAccount, LOCAL_TEST_ACCOUNT } from '../local-test-config.ts';

const status = JSON.parse(execFileSync('npx', ['--yes', 'supabase@2.117.0', 'status', '--output', 'json'], { encoding: 'utf8' }));
if (!canUseLocalTestAccount(true, 'true', status.API_URL)) throw new Error('Only the local Supabase stack is supported.');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({
  ...LOCAL_TEST_ACCOUNT,
  email_confirm: true,
  user_metadata: { full_name: 'Local Test Student' },
});
if (error && error.code !== 'email_exists') throw error;
console.log(data.user ? 'Local test account created. Complete onboarding in the app.' : 'Local test account already exists.');
console.log('Start Metro with EXPO_PUBLIC_LOCAL_TEST_AUTH=true and the local Supabase URL/publishable key.');
