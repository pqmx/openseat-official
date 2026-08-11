// @ts-nocheck — Deno, not the app's TypeScript. `npm run check` can't typecheck
// this file: it has Deno's globals and npm-less URL imports, and the repo's
// tsconfig is Expo's. Same situation as `policies.check.sql`, which is also real
// code that lives outside the one gate.
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * The Google Places proxy.
 *
 * It exists for one reason: the key. `EXPO_PUBLIC_*` is inlined into the app
 * bundle, and the Places *web service* has no application restriction that
 * actually holds — the iOS/Android key restrictions bind Google's native SDKs,
 * not the REST endpoint, and App Check doesn't cover the REST endpoint either.
 * Google's own security guidance for a mobile client calling a Maps web service
 * is a proxy server. This is it. The key lives in `GOOGLE_PLACES_KEY`, a
 * Supabase secret, and never leaves this side.
 *
 * Which makes the session check below the whole point. A proxy that skips it is
 * strictly worse than shipping the key: it's the same Google quota, on your
 * bill, except now it's free to call and takes no reverse engineering to find.
 * The check is written out here *as well as* left on at the gateway, not instead
 * of it. `config.toml` had said `verify_jwt = true` while the deployment had it
 * off — the file described a gate that wasn't there. They agree now: the gateway
 * turns away an unsigned request before this file runs, and the check below
 * keeps the thing being protected visible in the file that depends on it.
 *
 * **Two actions, one session token, and that is a billing decision.** Typing
 * used to call `places:searchText`, which bills per request on the Text Search
 * *Pro* SKU — the most expensive one in this flow, charged on every keystroke
 * that survived the debounce. `places:autocomplete` carrying a `sessionToken`
 * bills under *Autocomplete Session Usage* instead, whose free cap is unlimited:
 * the typing is free however long it goes on, and the one charge is the
 * `places/{id}` lookup that closes the session when a place is actually picked.
 *
 * The field masks are the other half of that. The prediction already carries the
 * name and the address, so the closing lookup asks for `location` and nothing
 * else — adding `displayName` there would move it from Place Details Essentials
 * to Pro for a string we were already given free.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// The campus, not the planet. Without this, "Kerckhoff" is as likely to be a
// street in another state as the hall 300m from the person typing.
const UCLA = { latitude: 34.0701, longitude: -118.4445 };

// Google groups requests by this, so it has to look like what Google expects and
// it has to be bounded — it is interpolated into a URL below.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Place IDs are opaque, so the only honest check is a shape and a ceiling.
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/;

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Sign in first.' }, 401);

  // The caller's own token, not the service role — so this asks Supabase who
  // they are, and a forged or expired JWT gets no user back.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);

  const key = Deno.env.get('GOOGLE_PLACES_KEY');
  if (!key) return json({ error: 'Place search is not configured.' }, 500);

  const { q, placeId, session } = await req.json().catch(() => ({}));
  if (typeof session !== 'string' || !UUID.test(session)) {
    return json({ error: 'Bad search session.' }, 400);
  }

  // Resolving a pick: the one billed call, and the end of the session.
  if (placeId !== undefined) {
    if (typeof placeId !== 'string' || !PLACE_ID.test(placeId)) {
      return json({ error: 'Bad place.' }, 400);
    }

    // The counter goes here and nowhere else. Typing is free inside an
    // autocomplete session, so the only call worth limiting is this one — and
    // being signed in was previously the whole limit, which meant any student
    // could hold a loop open against the Google bill. `spend_place_lookup()`
    // counts against the caller's own uid, so it can't be spent on anyone else.
    const { data: within, error: spend } = await supabase.rpc('spend_place_lookup');
    if (spend) {
      console.error('spend_place_lookup failed', spend.message);
      return json({ error: 'Could not pin that place.' }, 502);
    }
    if (!within) {
      return json({ error: "That's enough place searches for today." }, 429);
    }

    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${session}`,
      { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' } },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('places.get failed', res.status, text);
      return json({ error: 'Could not pin that place.' }, 502);
    }
    const { location } = await res.json();
    if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
      return json({ error: 'That place has no location.' }, 502);
    }
    return json({ lat: location.latitude, lng: location.longitude });
  }

  // Typing: free inside the session, so the only bound here is on abuse.
  // Under 2 characters is a query no one meant to run.
  if (typeof q !== 'string' || q.trim().length < 2 || q.length > 120) {
    return json({ error: 'Type a bit more.' }, 400);
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      // The name and the address ride along with the prediction, which is what
      // keeps the closing lookup on the Essentials tier.
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: q.trim(),
      sessionToken: session,
      locationBias: { circle: { center: UCLA, radius: 3000 } },
      includedRegionCodes: ['us'],
    }),
  });
  if (!res.ok) {
    // Read as text, not json: an error body isn't guaranteed to parse, and a
    // throw here would turn a clean 502 into an unhandled 500.
    const text = await res.text().catch(() => '');
    // Google's message can name the project or the key's restrictions, so it
    // stays in the logs rather than going to the phone.
    console.error('places:autocomplete failed', res.status, text);
    return json({ error: 'Place search failed.' }, 502);
  }
  const body = await res.json();

  // Mapped here, so `PlaceSuggestion` in `api.ts` is the shape on the wire and
  // swapping what's behind this function never touches the app.
  return json(
    (body.suggestions ?? [])
      .map((s: any) => s.placePrediction)
      .filter((p: any) => p?.placeId && p?.structuredFormat?.mainText?.text)
      .map((p: any) => ({
        id: p.placeId,
        title: p.structuredFormat.mainText.text,
        sub: p.structuredFormat.secondaryText?.text ?? '',
      })),
  );
});
