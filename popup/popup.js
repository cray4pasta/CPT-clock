import { formatDuration, formatTime } from '../lib/hours.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
let st = null;

// <input type="datetime-local"> works in local time without a zone suffix.
const toLocalInput = (t) => {
  const d = new Date(t);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v) => (v ? new Date(v).getTime() : null);

async function refresh() {
  st = await send({ type: 'GET_STATUS' });
  st.computedAt = Date.now();
  render();
}

function render() {
  const now = Date.now();
  const worked = st.worked + (st.active ? now - st.computedAt : 0);
  const hero = document.querySelector('.hero');
  hero.className = 'hero';

  if (st.active) {
    const left = st.clockOutAt - now;
    $('heroLabel').textContent = 'Clock out at';
    $('heroTime').textContent = formatTime(st.clockOutAt);
    $('heroSub').textContent = left > 0 ? `in ${formatDuration(left)}` : 'Clock out now';
    if (left <= 0) hero.classList.add('danger');
    else if (left <= 15 * 60000) hero.classList.add('warn');
    $('toggle').textContent = 'Clock out';
  } else {
    $('heroLabel').textContent = st.atTarget ? 'Weekly limit reached' : 'You can still work';
    $('heroTime').textContent = formatDuration(st.remaining);
    $('heroSub').textContent = st.overLimit ? 'Over the limit this week' : 'this week';
    if (st.overLimit) hero.classList.add('danger');
    $('toggle').textContent = 'Clock in';
  }
  $('iphone').disabled = !st.active;

  const pct = Math.min(100, (worked / st.limitMs) * 100);
  $('fill').style.width = `${pct}%`;
  $('fill').classList.toggle('danger', worked > st.targetMs);
  $('targetMark').style.left = `${(st.targetMs / st.limitMs) * 100}%`;
  $('weekText').textContent =
    `${formatDuration(worked)} of ${st.settings.weeklyLimitHours}h this week` +
    ` · ${st.settings.bufferMinutes} min safety buffer`;
}

function renderSessions() {
  const list = $('sessions');
  list.replaceChildren();
  const week = st.sessions.filter((s) => (s.end ?? Date.now()) > st.weekStart).reverse();
  if (!week.length) list.innerHTML = '<li>No shifts logged this week.</li>';
  for (const s of week) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="row">
        <input type="datetime-local" class="start">
        <input type="datetime-local" class="end" placeholder="now">
      </div>
      <button class="del" title="Delete shift">✕</button>
      <span class="dur"></span>`;
    li.querySelector('.start').value = toLocalInput(s.start);
    if (s.end) li.querySelector('.end').value = toLocalInput(s.end);
    li.querySelector('.dur').textContent = s.end ? formatDuration(s.end - s.start) : 'in progress';
    li.querySelectorAll('input').forEach((input) => {
      input.onchange = async () => {
        const start = fromLocalInput(li.querySelector('.start').value);
        const end = fromLocalInput(li.querySelector('.end').value);
        if (!start || (end && end <= start)) return;
        await send({ type: 'UPDATE_SESSION', id: s.id, start, end });
        await refresh();
        renderSessions();
      };
    });
    li.querySelector('.del').onclick = async () => {
      if (!confirm('Delete this shift?')) return;
      await send({ type: 'DELETE_SESSION', id: s.id });
      await refresh();
      renderSessions();
    };
    list.appendChild(li);
  }
}

$('toggle').onclick = async () => {
  const res = await send({ type: st.active ? 'CLOCK_OUT' : 'CLOCK_IN', source: 'popup' });
  if (!res.ok) alert(res.reason);
  await refresh();
  renderSessions();
};

$('iphone').onclick = () => send({ type: 'SEND_TO_IPHONE' });

$('add').onclick = async () => {
  const end = Date.now();
  await send({ type: 'ADD_SESSION', start: end - 60 * 60000, end });
  await refresh();
  renderSessions();
};

$('settings').onclick = (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
};

await refresh();
renderSessions();
setInterval(() => render(), 1000);
