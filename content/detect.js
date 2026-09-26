// Runs on Workday / ADP / UKG pages. A click on a Check In/Out button only *arms* detection; the punch
// is logged once the site shows its success message, using the time in that message. Cancelling the
// dialog disarms it, and if no confirmation appears the user is asked whether the punch went through.
(() => {
  const { matchButton, matchConfirm, parseConfirmTime, CANCEL } = globalThis.CPTPatterns;
  const CLICKABLE = 'button, [role="button"], a, input[type="button"], input[type="submit"]';
  const CONFIRM_TIMEOUT_MS = Number(document.documentElement.dataset.cptConfirmTimeoutMs) || 3 * 60 * 1000;
  let pending = null; // { type, clickedAt, timer }

  const labelOf = (el) =>
    (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
  const fmt = (t) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const noun = (type) => (type === 'CLOCK_IN' ? 'clock-in' : 'clock-out');

  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
    if (!el) return;
    const label = labelOf(el);
    const type = matchButton(label);
    if (type) return arm(type);
    if (pending && CANCEL.test(label)) disarm();
  }, true);

  function arm(type) {
    if (pending?.type === type) return; // double click on the same button
    disarm();
    pending = { type, clickedAt: Date.now() };
    pending.timer = setTimeout(askUnconfirmed, CONFIRM_TIMEOUT_MS);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan(document.body); // the message may already be on screen
  }

  function disarm() {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending = null;
    observer.disconnect();
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (!pending) return;
      if (m.type === 'characterData') scan(m.target.parentElement);
      else m.addedNodes.forEach((n) => scan(n.nodeType === Node.TEXT_NODE ? n.parentElement : n));
    }
  });

  // Look at the element's text and each of its descendants' text, so a short toast inside a big
  // container still matches.
  function scan(node) {
    if (!pending || !(node instanceof Element) || node.closest('[data-cpt-clock]')) return;
    const candidates = [node, ...node.querySelectorAll('*')].slice(0, 500);
    for (const el of candidates) {
      const text = el.innerText || el.textContent || '';
      if (text.length <= 300 && matchConfirm(text, pending.type)) return confirm(text);
    }
  }

  function confirm(text) {
    const { type, clickedAt } = pending;
    disarm();
    const at = parseConfirmTime(text, Date.now()) ?? Date.now();
    log(type, Math.max(at, clickedAt - 60 * 1000), 'confirmed');
  }

  function askUnconfirmed() {
    const { type, clickedAt } = pending;
    disarm();
    toast(`CPT Clock didn't see a confirmation. Did your ${noun(type)} at ${fmt(clickedAt)} go through?`, [
      { label: 'Log it', onClick: () => log(type, clickedAt, 'unconfirmed') },
      { label: 'Ignore' },
    ], 0);
  }

  function log(type, at, how) {
    chrome.runtime.sendMessage({ type, source: `${location.hostname} (${how})`, at }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      if (!res.ok) {
        const why = res.reason === 'already-clocked-in' ? 'you were already clocked in' : 'you weren\'t clocked in';
        return toast(`CPT Clock: ignored this ${noun(type)} because ${why}. Check the popup.`);
      }
      const s = res.session;
      toast(`CPT Clock: logged ${noun(type)} at ${fmt(type === 'CLOCK_IN' ? s.start : s.end)}. Open the extension for your clock-out time.`, [{
        label: 'Undo',
        onClick: () => chrome.runtime.sendMessage(type === 'CLOCK_IN'
          ? { type: 'DELETE_SESSION', id: s.id }
          : { type: 'UPDATE_SESSION', id: s.id, start: s.start, end: null }),
      }]);
    });
  }

  /** Small bottom-right toast in a closed shadow root. autoHideMs = 0 keeps it until a button is pressed. */
  function toast(text, actions = [], autoHideMs = 10000) {
    const host = document.createElement('div');
    host.dataset.cptClock = '';
    host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        .t{font:14px/1.4 -apple-system,system-ui,sans-serif;background:#202124;color:#fff;padding:12px 14px;
           border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;max-width:360px}
        button{font:inherit;background:none;border:0;color:#8ab4f8;cursor:pointer;font-weight:600;padding:0;white-space:nowrap}
      </style>
      <div class="t"><span></span></div>`;
    root.querySelector('span').textContent = text;
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => { a.onClick?.(); host.remove(); };
      root.querySelector('.t').appendChild(b);
    }
    document.documentElement.appendChild(host);
    if (autoHideMs) setTimeout(() => host.remove(), autoHideMs);
  }
})();
