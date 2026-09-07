export type ConnectionState = 'checking' | 'online' | 'offline';

/** A tiny, cache-busted request that succeeds only when the phone can reach the internet. */
export const checkConnection = async (fetcher: typeof fetch = fetch): Promise<ConnectionState> => {
  try {
    const response = await fetcher(
      `https://www.apple.com/library/test/success.html?openseat=${Date.now()}`,
      { method: 'HEAD', cache: 'no-store' },
    );
    return response.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
};
