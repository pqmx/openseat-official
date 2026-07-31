/**
 * Every time string the app shows, derived from a Date — nothing hardcoded.
 * No Intl: Hermes ships it, but hand-rolling four formats is smaller than
 * carrying a locale dependency and keeps `time.check.ts` deterministic.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** 9:30 PM · 2 PM — the :00 is dropped, as the design writes it. */
export const clock = (d: Date) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? 'AM' : 'PM';
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** Midnight of the day `d` falls on — day boundaries, not 24-hour windows. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const daysApart = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY);

/**
 * When a room opens, as the feed writes it: today is a bare time, the next
 * six days get a weekday, anything further gets a date.
 */
export const when = (at: Date, now: Date) => {
  const days = daysApart(at, now);
  if (days <= 0) return clock(at);
  if (days < 7) return `${DAYS[at.getDay()]} ${clock(at)}`;
  return `${DAYS[at.getDay()]} ${at.getMonth() + 1}/${at.getDate()}`;
};

/** How long a room has been live: "22 MIN", "3 HR", "2 DAYS". */
export const elapsed = (since: Date, now: Date) => {
  const ms = Math.max(0, now.getTime() - since.getTime());
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} MIN`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} HR`;
  const days = Math.floor(ms / DAY);
  return `${days} ${days === 1 ? 'DAY' : 'DAYS'}`;
};

/** Lower-case relative time under a note: "just now", "22 min ago". */
export const ago = (at: Date, now: Date) => {
  const ms = Math.max(0, now.getTime() - at.getTime());
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    return `${h} hr ago`;
  }
  const days = Math.floor(ms / DAY);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};
