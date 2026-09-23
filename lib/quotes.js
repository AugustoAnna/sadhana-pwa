/*
 * quotes.js — Sadhguru's quotes (global `quotes`): the quote of the day on the Journal, and a
 * different quote for Daily Reflection.
 *
 * Quotes are fetched live from content.quotesApi, one request per day, and kept in the database
 * (kv 'quotes.cache': { 'YYYY-MM-DD': { text } }, kv 'quotes.reflection') so they still show offline.
 */
(function () {
  'use strict';

  const KEEP_DAYS = 90;
  const pending = new Set();

  // Plain text from the API field (decodes entities like &#39; and drops any tags).
  function plain(html) {
    return (new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || '').trim();
  }

  function fetchDay(date) {
    const url = content.quotesApi + '?language_code=en&date=' + date;
    return fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const q = json && json.response && json.response.data && json.response.data[0];
        return q && q.eng_text ? { text: plain(q.eng_text) } : null;
      })
      .catch(() => null);
  }

  // Quotes we have for the last `days` days, newest first: [{ date, text }].
  function list(days) {
    const cache = db.get('quotes.cache', {});
    const today = db.today();
    const out = [];
    for (let i = 0; i < days; i++) {
      const date = db.addDays(today, -i);
      if (cache[date]) out.push({ date, text: cache[date].text });
    }
    return out;
  }

  // Fetch the days in the last `days` that aren't cached yet.
  function refresh(days) {
    const cache = db.get('quotes.cache', {});
    const today = db.today();
    const missing = [];
    for (let i = 0; i < days; i++) {
      const date = db.addDays(today, -i);
      if (!cache[date] && !pending.has(date)) missing.push(date);
    }
    if (!missing.length) return Promise.resolve();
    missing.forEach((d) => pending.add(d));
    return Promise.all(missing.map((date) => fetchDay(date).then((q) => [date, q]))).then((results) => {
      missing.forEach((d) => pending.delete(d));
      const next = db.get('quotes.cache', {});
      results.forEach(([date, q]) => { if (q) next[date] = q; });
      const oldest = db.addDays(today, -KEEP_DAYS);
      Object.keys(next).forEach((date) => { if (date < oldest) delete next[date]; });
      db.set('quotes.cache', next);
    });
  }

  // Daily Reflection's quote is a different one from the Journal's: the quote of a day 4 to 12
  // months back (older than anything the Journal shows), picked from the date so it stays the same
  // all day and changes the next.
  function reflectionSource(date, attempt) {
    let h = attempt * 7919;
    for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0;
    return db.addDays(date, -(120 + (h % 240)));
  }

  // The reflection quote for `date`; before it loads (e.g. offline), the last one we had.
  function reflection(date) {
    const saved = db.get('quotes.reflection', {});
    if (saved[date]) return saved[date].text;
    const last = Object.keys(saved).sort().pop();
    return last ? saved[last].text : null;
  }

  function refreshReflection(date) {
    const key = 'reflection:' + date;
    if (db.get('quotes.reflection', {})[date] || pending.has(key)) return Promise.resolve();
    pending.add(key);
    const pick = (attempt) => {
      if (attempt === 3) return Promise.resolve(null);
      const from = reflectionSource(date, attempt);
      return fetchDay(from).then((q) => {
        const journal = db.get('quotes.cache', {})[date];
        return q && !(journal && journal.text === q.text) ? { from, text: q.text } : pick(attempt + 1);
      });
    };
    // Load the Journal's quote of the day first, so the two are never the same.
    return refresh(1)
      .then(() => pick(0))
      .then((q) => {
        if (!q) return;
        const next = { ...db.get('quotes.reflection', {}), [date]: q };
        Object.keys(next).sort().slice(0, -7).forEach((d) => delete next[d]); // keep a week
        db.set('quotes.reflection', next);
      })
      .finally(() => pending.delete(key));
  }

  window.quotes = { list, refresh, reflection, refreshReflection };
})();
