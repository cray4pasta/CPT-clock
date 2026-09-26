import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUR, MIN, weekStart, weekEnd, workedBetween, computeStatus, formatDuration, shortcutDateText, shortcutUrl,
} from '../lib/hours.js';

// Local-time helper: month is 1-based. 2026-09-20 is a Sunday.
const at = (mo, d, h, m = 0) => new Date(2026, mo - 1, d, h, m).getTime();
const settings = { weeklyLimitHours: 20, bufferMinutes: 10, weekStartDay: 0 };

test('week starts on Sunday or Monday', () => {
  const wed = at(9, 23, 14);
  assert.equal(weekStart(wed, 0), at(9, 20, 0));
  assert.equal(weekStart(wed, 1), at(9, 21, 0));
  assert.equal(weekEnd(wed, 0), at(9, 27, 0));
  // Sunday with a Monday week start belongs to the previous week.
  assert.equal(weekStart(at(9, 20, 10), 1), at(9, 14, 0));
});

test('fresh week: clock-out is 19h50m after clocking in', () => {
  const start = at(9, 21, 9);
  const st = computeStatus([{ start, end: null }], start, settings);
  assert.equal(st.worked, 0);
  assert.equal(st.clockOutAt, start + 19 * HOUR + 50 * MIN);
});

test('18.5h already worked: 1h20m left', () => {
  const sessions = [
    { start: at(9, 21, 9), end: at(9, 21, 17) }, // 8h
    { start: at(9, 22, 9), end: at(9, 22, 17) }, // 8h
    { start: at(9, 23, 9), end: at(9, 23, 11, 30) }, // 2.5h
    { start: at(9, 24, 13), end: null },
  ];
  const st = computeStatus(sessions, at(9, 24, 13), settings);
  assert.equal(st.worked, 18.5 * HOUR);
  assert.equal(st.remaining, 80 * MIN);
  assert.equal(st.clockOutAt, at(9, 24, 14, 20));
});

test('clock-out time stays fixed as the shift progresses', () => {
  const sessions = [{ start: at(9, 21, 9), end: at(9, 21, 19) }, { start: at(9, 22, 9), end: null }];
  const a = computeStatus(sessions, at(9, 22, 9), settings).clockOutAt;
  const b = computeStatus(sessions, at(9, 22, 12, 17), settings).clockOutAt;
  assert.equal(a, b);
  assert.equal(a, at(9, 22, 18, 50));
});

test('buffer already used up: clock out now, not over limit yet', () => {
  const sessions = [{ start: at(9, 21, 0), end: at(9, 21, 19, 55) }, { start: at(9, 22, 9), end: null }];
  const now = at(9, 22, 9);
  const st = computeStatus(sessions, now, settings);
  assert.equal(st.atTarget, true);
  assert.equal(st.overLimit, false);
  assert.equal(st.remaining, 0);
  assert.equal(st.clockOutAt, now);
});

test('over 20h is flagged', () => {
  const sessions = [{ start: at(9, 21, 0), end: at(9, 21, 20, 30) }];
  const st = computeStatus(sessions, at(9, 22, 9), settings);
  assert.equal(st.overLimit, true);
  assert.equal(st.clockOutAt, null);
});

test('shift crossing midnight counts fully in the same week', () => {
  const sessions = [{ start: at(9, 22, 22), end: at(9, 23, 2) }]; // Tue 10pm to Wed 2am
  assert.equal(workedBetween(sessions, at(9, 20, 0), at(9, 27, 0), at(9, 24, 0)), 4 * HOUR);
});

test('shift crossing the week boundary is split between weeks', () => {
  const sessions = [{ start: at(9, 26, 22), end: at(9, 27, 3) }]; // Sat 10pm to Sun 3am
  const now = at(9, 27, 12);
  const thisWeek = computeStatus(sessions, now, settings);
  assert.equal(thisWeek.worked, 3 * HOUR);
  const lastWeek = computeStatus(sessions, at(9, 26, 23, 59), settings);
  assert.equal(lastWeek.worked, 2 * HOUR - MIN);
});

test('open shift that would run past week end restarts the count next week', () => {
  const sessions = [{ start: at(9, 26, 23), end: null }]; // Sat 11pm, fresh week
  const st = computeStatus(sessions, at(9, 26, 23), settings);
  assert.equal(st.clockOutAt, at(9, 27, 0) + 19 * HOUR + 50 * MIN);
});

test('sessions from last week are ignored', () => {
  const sessions = [{ start: at(9, 19, 9), end: at(9, 19, 19) }, { start: at(9, 21, 9), end: null }];
  const st = computeStatus(sessions, at(9, 21, 9), settings);
  assert.equal(st.worked, 0);
});

test('formatting helpers', () => {
  assert.equal(formatDuration(80 * MIN), '1h 20m');
  assert.equal(formatDuration(-5), '0h 00m');
  assert.equal(shortcutDateText(at(9, 26, 17, 42)), 'September 26, 2026 at 5:42 PM');
  assert.match(shortcutUrl('CPT Clock Reminder', at(9, 26, 17, 42)),
    /^shortcuts:\/\/run-shortcut\?name=CPT%20Clock%20Reminder&input=text&text=September%2026%2C%202026%20at%205%3A42/);
});
