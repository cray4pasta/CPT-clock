import test from 'node:test';
import assert from 'node:assert/strict';
import '../lib/patterns.js'; // classic script: sets globalThis.CPTPatterns

const { matchButton, matchConfirm, parseConfirmTime, CANCEL } = globalThis.CPTPatterns;
const at = (h, m = 0) => new Date(2026, 8, 24, h, m).getTime();

test('button labels', () => {
  for (const l of ['Check In', 'check in', 'Clock-In', 'Punch In', 'CHECKIN', 'Time In']) assert.equal(matchButton(l), 'CLOCK_IN', l);
  for (const l of ['Check Out', 'Clock Out', 'Punch out']) assert.equal(matchButton(l), 'CLOCK_OUT', l);
  for (const l of ['Check in history', 'Checked In', 'Login', 'In', 'Clock']) assert.equal(matchButton(l), null, l);
});

test('cancel labels', () => {
  assert.ok(CANCEL.test('Cancel'));
  assert.ok(CANCEL.test('Close'));
  assert.ok(!CANCEL.test('Cancel shift'));
});

test('confirmation messages', () => {
  assert.ok(matchConfirm('You checked in at 9:02 AM', 'CLOCK_IN'));
  assert.ok(matchConfirm('Successfully clocked in', 'CLOCK_IN'));
  assert.ok(matchConfirm('Check-in successful', 'CLOCK_IN'));
  assert.ok(matchConfirm('Punch recorded', 'CLOCK_IN'));
  assert.ok(matchConfirm('Success', 'CLOCK_OUT'));
  assert.ok(matchConfirm('You have checked out', 'CLOCK_OUT'));
  // Wrong direction or unrelated text does not confirm.
  assert.ok(!matchConfirm('You checked out at 5:00 PM', 'CLOCK_IN'));
  assert.ok(!matchConfirm('Check In', 'CLOCK_IN')); // the button label itself
  assert.ok(!matchConfirm('Enter your time type', 'CLOCK_IN'));
  assert.ok(!matchConfirm('x'.repeat(400) + ' checked in', 'CLOCK_IN'));
});

test('parse time from confirmation', () => {
  const now = at(9, 3);
  assert.equal(parseConfirmTime('You checked in at 9:02 AM', now), at(9, 2));
  assert.equal(parseConfirmTime('Checked in 09:02', now), at(9, 2));
  assert.equal(parseConfirmTime('checked in at 9:02 a.m.', now), at(9, 2));
  assert.equal(parseConfirmTime('Clocked out at 21:30', at(21, 31)), at(21, 30));
  assert.equal(parseConfirmTime('Clocked out at 9:30 PM', at(21, 31)), at(21, 30));
  assert.equal(parseConfirmTime('You checked in', now), null);
  assert.equal(parseConfirmTime('checked in at 3:00 PM', now), null); // hours in the future
  assert.equal(parseConfirmTime('checked in at 1:00 AM', now), null); // too far back
  // Seen just after midnight for a punch at 11:58 PM the previous day.
  assert.equal(parseConfirmTime('checked out at 11:58 PM', new Date(2026, 8, 25, 0, 1).getTime()), new Date(2026, 8, 24, 23, 58).getTime());
});
