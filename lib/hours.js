// Pure time math for CPT Clock. No Chrome APIs here so it can be unit-tested with `node --test`.
// All times are epoch milliseconds; "weeks" are in the computer's local time zone.

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;

export const DEFAULT_SETTINGS = {
  weeklyLimitHours: 20,
  bufferMinutes: 10,
  weekStartDay: 0, // 0 = Sunday, 1 = Monday
  leadMinutes: [15, 5, 0],
  shortcutName: 'CPT Clock Reminder',
  autoSendToIphone: false,
};

/** Midnight at the start of the week containing `time`. */
export function weekStart(time, startDay = 0) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - startDay + 7) % 7));
  return d.getTime();
}

/** Midnight at the start of the following week (setDate keeps this DST-safe). */
export function weekEnd(time, startDay = 0) {
  const d = new Date(weekStart(time, startDay));
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

/** Milliseconds worked inside [from, to). An open session (end == null) runs until `now`. */
export function workedBetween(sessions, from, to, now) {
  let total = 0;
  for (const s of sessions) {
    const start = Math.max(s.start, from);
    const end = Math.min(s.end ?? now, to, now);
    if (end > start) total += end - start;
  }
  return total;
}

export function activeSession(sessions) {
  return sessions.find((s) => s.end == null) ?? null;
}

/**
 * Everything the UI and alarms need.
 * clockOutAt: when to clock out to land exactly on (limit − buffer) this week; null if not clocked in.
 */
export function computeStatus(sessions, now, settings = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const ws = weekStart(now, s.weekStartDay);
  const we = weekEnd(now, s.weekStartDay);
  const limitMs = s.weeklyLimitHours * HOUR;
  const targetMs = Math.max(0, limitMs - s.bufferMinutes * MIN);
  const worked = workedBetween(sessions, ws, we, now);
  const remaining = targetMs - worked;
  const active = activeSession(sessions);

  let clockOutAt = null;
  if (active) {
    clockOutAt = now + Math.max(0, remaining);
    // A shift that runs past the week boundary starts counting toward next week from zero.
    if (clockOutAt > we) clockOutAt = we + targetMs;
  }

  return {
    weekStart: ws,
    weekEnd: we,
    limitMs,
    targetMs,
    worked,
    remaining: Math.max(0, remaining),
    active,
    clockOutAt,
    atTarget: remaining <= 0,
    overLimit: worked > limitMs,
  };
}

export function formatDuration(ms) {
  const totalMin = Math.floor(Math.max(0, ms) / MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatTime(time) {
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Text the Apple Shortcut's "Get Dates from Input" understands, e.g. "September 26, 2026 at 5:42 PM". */
export function shortcutDateText(time) {
  return new Date(time).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
}

export function shortcutUrl(name, time) {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(shortcutDateText(time))}`;
}
