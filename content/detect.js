// Runs on Workday / ADP / UKG pages. Watches for clicks on clock-in/out buttons and tells the
// background worker. Shows a small toast with Undo, since a click can be cancelled in a dialog.
(() => {
  const IN_RE = /^(check|clock|punch|time)[\s-]*in$/i;
  const OUT_RE = /^(check|clock|punch|time)[\s-]*out$/i;
  const CLICKABLE = 'button, [role="button"], a, input[type="button"], input[type="submit"]';
  let lastAt = 0;

  function labelOf(el) {
    return (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
  }

  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
    if (!el) return;
    const label = labelOf(el);
    const type = IN_RE.test(label) ? 'CLOCK_IN' : OUT_RE.test(label) ? 'CLOCK_OUT' : null;
    if (!type || Date.now() - lastAt < 3000) return;
    lastAt = Date.now();
    chrome.runtime.sendMessage({ type, source: location.hostname, at: Date.now() }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      if (res.ok) toast(type, res.session);
      else if (res.reason === 'already-clocked-in') toast(null, null, 'CPT Clock: you were already clocked in.');
    });
  }, true);

  function toast(type, session, text) {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px';
    const root = host.attachShadow({ mode: 'closed' });
    const time = session ? new Date(type === 'CLOCK_IN' ? session.start : session.end)
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    root.innerHTML = `
      <style>
        .t{font:14px/1.4 -apple-system,system-ui,sans-serif;background:#202124;color:#fff;padding:12px 14px;
           border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);display:flex;gap:12px;align-items:center;max-width:340px}
        button{font:inherit;background:none;border:0;color:#8ab4f8;cursor:pointer;font-weight:600;padding:0}
      </style>
      <div class="t"><span></span><button hidden>Undo</button></div>`;
    root.querySelector('span').textContent = text ||
      `CPT Clock: logged ${type === 'CLOCK_IN' ? 'clock-in' : 'clock-out'} at ${time}. Open the extension for your clock-out time.`;
    const undo = root.querySelector('button');
    if (session) {
      undo.hidden = false;
      undo.onclick = () => {
        const msg = type === 'CLOCK_IN'
          ? { type: 'DELETE_SESSION', id: session.id }
          : { type: 'UPDATE_SESSION', id: session.id, start: session.start, end: null };
        chrome.runtime.sendMessage(msg);
        host.remove();
      };
    }
    document.documentElement.appendChild(host);
    setTimeout(() => host.remove(), 10000);
  }
})();
