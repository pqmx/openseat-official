// @ts-nocheck -- Deno entry point; handler.ts is checked by TypeScript and Node.
import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { createPlacesHandler } from './handler.ts';

Deno.serve(createPlacesHandler({
  key: Deno.env.get('GOOGLE_PLACES_KEY'),
  client: (authorization) => createClient(
    Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false } },
  ),
}));
