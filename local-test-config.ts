export const canUseLocalTestAccount = (development: boolean, enabled: string | undefined, url: string | undefined) =>
  development && enabled === 'true' && /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url ?? '');

export const LOCAL_TEST_ACCOUNT = {
  email: 'openseat-local-test@ucla.edu',
  password: 'Local-only-openseat-test-2026!',
};
