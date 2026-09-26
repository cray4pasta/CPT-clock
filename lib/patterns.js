// Text patterns for spotting clock-in/out on timekeeping sites. A classic script (not an ES module)
// because content scripts can't import; it sets globalThis.CPTPatterns (tests import it for that side effect).
(function (root) {
  const BUTTON_IN = /^(check|clock|punch|time)[\s-]*in$/i;
  const BUTTON_OUT = /^(check|clock|punch|time)[\s-]*out$/i;
  const CANCEL = /^(cancel|close|discard|no)$/i;

  // Success messages shown after a punch actually goes through. First guesses: tune to your site's wording.
  const CONFIRM_IN = [
    /\b(you('ve| have)?\s+)?(successfully\s+)?(checked|clocked|punched)\s+in\b/i,
    /\b(check|clock|punch)[\s-]*in\s+(was\s+)?(successful|recorded|accepted|submitted|complete)/i,
  ];
  const CONFIRM_OUT = [
    /\b(you('ve| have)?\s+)?(successfully\s+)?(checked|clocked|punched)\s+out\b/i,
    /\b(check|clock|punch)[\s-]*out\s+(was\s+)?(successful|recorded|accepted|submitted|complete)/i,
  ];
  // Generic success that only counts right after an armed click, e.g. "Punch recorded" / "Success".
  const CONFIRM_GENERIC = [/\b(punch|time entry|entry)\s+(was\s+)?(recorded|accepted|submitted|saved)\b/i, /^success!?$/i];

  function matchButton(label) {
    if (BUTTON_IN.test(label)) return 'CLOCK_IN';
    if (BUTTON_OUT.test(label)) return 'CLOCK_OUT';
    return null;
  }

  /** Does `text` confirm a punch of the pending type ('CLOCK_IN' | 'CLOCK_OUT')? */
  function matchConfirm(text, pendingType) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t || t.length > 300) return false;
    const own = pendingType === 'CLOCK_IN' ? CONFIRM_IN : CONFIRM_OUT;
    const other = pendingType === 'CLOCK_IN' ? CONFIRM_OUT : CONFIRM_IN;
    if (own.some((re) => re.test(t))) return true;
    if (other.some((re) => re.test(t))) return false;
    return CONFIRM_GENERIC.some((re) => re.test(t));
  }

  /**
   * Pull a clock time ("9:02 AM", "09:02", "21:02") out of a confirmation message and place it on `now`'s date.
   * Returns epoch ms, or null when there's no time or it isn't plausible (>5 min ahead or >3 h behind).
   */
  function parseConfirmTime(text, now) {
    const m = text.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])\.?\s*m\.?\b/i) || text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2]);
    if (min > 59) return null;
    if (m[3]) {
      if (h < 1 || h > 12) return null;
      h = (h % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
    }
    const d = new Date(now);
    d.setHours(h, min, 0, 0);
    let t = d.getTime();
    if (t - now > 12 * 3600e3) t -= 24 * 3600e3; // e.g. "11:58 PM" seen just after midnight
    if (t - now > 5 * 60e3 || now - t > 3 * 3600e3) return null;
    return t;
  }

  const api = { BUTTON_IN, BUTTON_OUT, CANCEL, matchButton, matchConfirm, parseConfirmTime };
  root.CPTPatterns = api;
})(globalThis);
