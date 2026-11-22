/** Asia/Manila is UTC+8 all year (no DST). All monthly jobs use Manila calendar dates. */
export const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ManilaDate {
  y: number;
  m: number; // 1-12
  day: number;
  hour: number;
}

export function manila(now: Date): ManilaDate {
  const d = new Date(now.getTime() + MANILA_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours() };
}

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const periodKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
export const nextMonth = (y: number, m: number) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 });

/** 00:00 Asia/Manila on the 1st of (y, m), as a UTC instant. */
export const monthStartUtc = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1) - MANILA_OFFSET_MS);

/**
 * Start of the reverify window for the reset on the 1st of (y, m): 7 days before, 00:00 Manila.
 * The reminder goes out at this point, and a VIP approved on/after it counts for the next month
 * ("mag-reverify bago mag-1st"), so that reset skips them.
 */
export const reverifyWindowStartUtc = (y: number, m: number) => new Date(monthStartUtc(y, m).getTime() - 7 * DAY_MS);

/** The upcoming reset (the next 1st, Manila) relative to `now`. */
export function upcomingReset(now: Date): { y: number; m: number; key: string; startsAt: Date; windowStart: Date } {
  const t = manila(now);
  const n = nextMonth(t.y, t.m);
  return { ...n, key: periodKey(n.y, n.m), startsAt: monthStartUtc(n.y, n.m), windowStart: reverifyWindowStartUtc(n.y, n.m) };
}

/** True from 00:00 Manila 7 days before the 1st until the 1st. */
export const inReverifyWindow = (now: Date) => now.getTime() >= upcomingReset(now).windowStart.getTime();

/** Reset may START only on days 1..RESET_CATCHUP_DAYS (Manila), so a mid-month deploy never wipes VIP. */
export const RESET_CATCHUP_DAYS = 3;
