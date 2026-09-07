type Client = {
  auth: { getUser(): Promise<{ data: { user: unknown }; error?: unknown }> };
  rpc(name: string): PromiseLike<{ data: unknown; error: unknown }>;
};
type Dependencies = { key?: string; client: (authorization: string) => Client; fetcher?: typeof fetch };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/;
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function readBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw new Error('Body too large');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel();
  }
}

/** Every Google request is authenticated, validated and charged to a server counter. */
export const createPlacesHandler = ({ key, client, fetcher = fetch }: Dependencies) => async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401);
  try {
    const supabase = client(authorization);
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: 'Sign in first.' }, 401);
    if (!key) return json({ error: 'Place search is not configured.' }, 500);

    let body;
    try { body = await readBody(req); }
    catch { return json({ error: 'Bad search request.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Bad search request.' }, 400);
    const { q, placeId, session } = body as Record<string, unknown>;
    if (typeof session !== 'string' || !UUID.test(session)) return json({ error: 'Bad search session.' }, 400);
    const details = placeId !== undefined;
    if (details ? typeof placeId !== 'string' || !PLACE_ID.test(placeId)
                : typeof q !== 'string' || q.trim().length < 2 || q.length > 120) {
      return json({ error: 'Bad place search.' }, 400);
    }

    const { data: within, error: spendError } = await supabase.rpc(
      details ? 'spend_place_lookup' : 'spend_place_autocomplete',
    );
    if (spendError) return json({ error: 'Place search is temporarily unavailable.' }, 502);
    if (within !== true) return json({ error: "That's enough place searches for today." }, 429);

    const res = details
      ? await fetcher(`https://places.googleapis.com/v1/places/${placeId}?sessionToken=${session}`, {
          headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'location' },
          signal: AbortSignal.timeout(8000),
        })
      : await fetcher('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat' },
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ input: (q as string).trim(), sessionToken: session,
            locationBias: { circle: { center: { latitude: 34.0701, longitude: -118.4445 }, radius: 3000 } },
            includedRegionCodes: ['us'] }),
        });
    if (!res.ok) return json({ error: 'Place search failed.' }, 502);
    const result = await res.json();
    if (details) {
      const { latitude, longitude } = result?.location ?? {};
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
          || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return json({ error: 'That place has no location.' }, 502);
      }
      return json({ lat: latitude, lng: longitude });
    }
    return json((Array.isArray(result?.suggestions) ? result.suggestions : [])
      .map((s: any) => s?.placePrediction)
      .filter((p: any) => typeof p?.placeId === 'string' && typeof p?.structuredFormat?.mainText?.text === 'string')
      .slice(0, 10)
      .map((p: any) => ({ id: p.placeId, title: p.structuredFormat.mainText.text,
        sub: typeof p.structuredFormat.secondaryText?.text === 'string' ? p.structuredFormat.secondaryText.text : '' })));
  } catch {
    return json({ error: 'Place search is temporarily unavailable.' }, 502);
  }
};
