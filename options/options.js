import { DEFAULT_SETTINGS } from '../lib/hours.js';

const form = document.getElementById('form');
const { settings = {} } = await chrome.storage.local.get('settings');
const s = { ...DEFAULT_SETTINGS, ...settings };

form.weeklyLimitHours.value = s.weeklyLimitHours;
form.bufferMinutes.value = s.bufferMinutes;
form.weekStartDay.value = String(s.weekStartDay);
form.leadMinutes.value = s.leadMinutes.join(', ');
form.shortcutName.value = s.shortcutName;
form.autoSendToIphone.checked = s.autoSendToIphone;

form.onsubmit = async (e) => {
  e.preventDefault();
  await chrome.storage.local.set({
    settings: {
      weeklyLimitHours: Number(form.weeklyLimitHours.value),
      bufferMinutes: Number(form.bufferMinutes.value),
      weekStartDay: Number(form.weekStartDay.value),
      leadMinutes: [...new Set(form.leadMinutes.value.split(',').map((x) => Number(x.trim())))].sort((a, b) => b - a),
      shortcutName: form.shortcutName.value.trim(),
      autoSendToIphone: form.autoSendToIphone.checked,
    },
  });
  document.getElementById('saved').textContent = 'Saved';
  setTimeout(() => (document.getElementById('saved').textContent = ''), 2000);
};
