/** Shared release defaults; the lifecycle migration enforces the same duration. */
export const ROOM_DURATION_HOURS = 4;
export const ROOM_PAGE_SIZE = 40;
export const MAX_UPDATE_LENGTH = 500;
export const MAX_REPORT_LENGTH = 1000;
export type FeedWindow = 'Live' | 'Tonight' | 'This week';

export const classYearsAt = (now: Date) => {
  const academicYear = now.getFullYear() + (now.getMonth() >= 7 ? 1 : 0);
  return [...Array.from({ length: 4 }, (_, i) => `'${String(academicYear + i).slice(-2)}`), 'Grad'];
};
export const roomShareUrl = (id: string) => `openseat://room/${encodeURIComponent(id)}`;
export const safeRoomDestination = (value: unknown) =>
  typeof value === 'string' && /^\/room\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value : '/discover';
