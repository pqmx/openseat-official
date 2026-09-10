export class UserError extends Error {}

const safeMessages = new Set([
  'This room is closed.', 'This room is already closed.', 'That room is full.',
  'You have opened too many rooms in the last hour.',
  'Too many reports in the last hour.', 'Too many room updates in the last hour.',
  'That start time is not a time you can open a room for.',
]);

/** Never present arbitrary provider or database messages to students. */
export const errorMessage = (error: unknown) => {
  if (error instanceof UserError) return error.message;
  const e = error as { code?: string; message?: string } | undefined;
  if (e?.message && safeMessages.has(e.message)) return e.message;
  if (e?.code === '23505') return 'This action was already recorded. Refresh to see the latest state.';
  if (e?.code === '42501') return 'This action is no longer available. Refresh the room and try again.';
  if (e?.code === '23514') return 'Check your entry and refresh the room before trying again.';
  if (error instanceof TypeError || /network|fetch|timeout/i.test(e?.message ?? ''))
    return 'Could not connect. Check your connection, then try again.';
  return 'Something went wrong. Please try again.';
};
