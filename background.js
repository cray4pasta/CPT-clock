// Service worker: owns the session log, schedules clock-out alarms, and shows notifications.
import { DEFAULT_SETTINGS, MIN, computeStatus, activeSession, formatTime, formatDuration, shortcutUrl } from './lib/hours.js';

const LEAD_PREFIX = 'cpt-lead-';
const TICK = 'cpt-tick';

async function load() {
  const { sessions = [], settings = {} } = await chrome.storage.local.get(['sessions', 'settings']);
  return { sessions, settings: { ...DEFAULT_SETTINGS, ...settings } };
}

const saveSessions = (sessions) => chrome.storage.local.set({ sessions });

async function status() {
  const { sessions, settings } = await load();
  return { ...computeStatus(sessions, Date.now(), settings), sessions, settings };
}

async function clockIn(source = 'manual', at = Date.now()) {
  const { sessions, settings } = await load();
  if (activeSession(sessions)) return { ok: false, reason: 'already-clocked-in' };
  const session = { id: crypto.randomUUID(), start: at, end: null, source };
  sessions.push(session);
  await saveSessions(sessions);
  await reschedule();
  if (settings.autoSendToIphone) await sendToIphone();
  return { ok: true, session };
}

async function clockOut(at = Date.now()) {
  const { sessions } = await load();
  const active = activeSession(sessions);
  if (!active) return { ok: false, reason: 'not-clocked-in' };
  active.end = Math.max(at, active.start);
  await saveSessions(sessions);
  await reschedule();
  return { ok: true, session: active };
}

async function editSessions(mutate) {
  const { sessions } = await load();
  const next = mutate(sessions);
  next.sort((a, b) => a.start - b.start);
  await saveSessions(next);
  await reschedule();
  return { ok: true };
}

async function sendToIphone() {
  const st = await status();
  if (!st.clockOutAt) return { ok: false, reason: 'not-clocked-in' };
  // Opens the macOS Shortcuts app, which creates an iCloud Reminder that alerts on the iPhone.
  await chrome.tabs.create({ url: shortcutUrl(st.settings.shortcutName, st.clockOutAt) });
  return { ok: true };
}

async function reschedule() {
  const all = await chrome.alarms.getAll();
  await Promise.all(all.filter((a) => a.name.startsWith(LEAD_PREFIX)).map((a) => chrome.alarms.clear(a.name)));
  const st = await status();
  if (st.clockOutAt) {
    const now = Date.now();
    for (const lead of st.settings.leadMinutes) {
      const when = st.clockOutAt - lead * MIN;
      if (when > now) chrome.alarms.create(`${LEAD_PREFIX}${lead}`, { when });
    }
    if (st.clockOutAt <= now) notify(0, st);
    chrome.alarms.create(TICK, { periodInMinutes: 1 });
  } else {
    chrome.alarms.clear(TICK);
  }
  updateBadge(st);
}

function updateBadge(st) {
  if (!st.active) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const left = Math.max(0, st.clockOutAt - Date.now());
  const text = left >= 60 * MIN ? `${Math.floor(left / (60 * MIN))}h` : `${Math.ceil(left / MIN)}m`;
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: left <= 15 * MIN ? '#d93025' : '#1a73e8' });
}

function notify(lead, st) {
  const time = formatTime(st.clockOutAt);
  const title = lead === 0 ? 'Clock out now' : `Clock out in ${lead} min`;
  const message = lead === 0
    ? `Time to clock out (${time}). You'll be at ${formatDuration(st.targetMs)} for the week.`
    : `Clock out at ${time} to stay under ${st.settings.weeklyLimitHours}h this week.`;
  chrome.notifications.create(`cpt-note-${lead}-${st.clockOutAt}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 2,
    requireInteraction: lead <= 5,
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const st = await status();
  if (alarm.name === TICK) return updateBadge(st);
  if (!alarm.name.startsWith(LEAD_PREFIX) || !st.active) return;
  notify(Number(alarm.name.slice(LEAD_PREFIX.length)), st);
});

chrome.runtime.onStartup.addListener(reschedule);
chrome.runtime.onInstalled.addListener(reschedule);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) reschedule();
});

const handlers = {
  GET_STATUS: () => status(),
  CLOCK_IN: (m) => clockIn(m.source, m.at),
  CLOCK_OUT: (m) => clockOut(m.at),
  SEND_TO_IPHONE: () => sendToIphone(),
  DELETE_SESSION: (m) => editSessions((s) => s.filter((x) => x.id !== m.id)),
  UPDATE_SESSION: (m) => editSessions((s) => s.map((x) => (x.id === m.id ? { ...x, start: m.start, end: m.end } : x))),
  ADD_SESSION: (m) => editSessions((s) => [...s, { id: crypto.randomUUID(), start: m.start, end: m.end, source: 'manual-edit' }]),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler(msg).then(sendResponse, (err) => sendResponse({ ok: false, reason: String(err) }));
  return true; // async response
});
