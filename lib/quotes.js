/*
 * quotes.js — Sadhguru's quote of the day (global `quotes`), shown on the Journal.
 *
 * Quotes are fetched live from content.quotesApi, one request per day, and kept in the database
 * (kv 'quotes.cache': { 'YYYY-MM-DD': { text } }) so they still show offline.
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

  window.quotes = { list, refresh };
})();
