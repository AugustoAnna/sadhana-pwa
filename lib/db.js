/*
 * db.js — the app's small IndexedDB layer. Exposes one global: `db`.
 *
 * IndexedDB database "sadhana-pwa" has two object stores:
 *
 *   kv       { key, value, updatedAt }       Settings & current state ("save").
 *            db.get(key, fallback)   db.set(key, value)   db.del(key)
 *
 *   entries  { id, type, date, ts, data }    Time-stamped log of what you do ("track").
 *            db.add(type, data)              db.list(type, filter)   db.latest(type, filter)
 *            db.upsert(type, data, {key})    db.update(id, data)     db.remove(id)
 *
 * When a page opens, every record is read into memory (support.js waits for `db.ready` before any
 * screen renders), so reads are synchronous and safe inside renderVals(). Writes update memory at
 * once, notify db.on() listeners (screens re-render), and are saved to IndexedDB in one batched
 * transaction a moment later. db.flush() resolves when everything is on disk; support.js calls it
 * before navigating away, so nothing is lost between screens.
 *
 * Dates are local calendar days as 'YYYY-MM-DD' strings (helpers at the bottom).
 *
 * Filters for list/latest:  { date, from, to, match: { field: value }, where: (entry) => bool, limit }
 *   `match` compares against entry.data, e.g. db.list('practice', { date: db.today(), match: { practice: 'isha' } })
 */
(function () {
  'use strict';

  const DB_NAME = 'sadhana-pwa';
  const DB_VERSION = 1;
  const WRITE_DELAY = 120; // ms: rapid writes (e.g. typing) are coalesced into one transaction

  const kv = new Map();      // key -> { key, value, updatedAt }
  const entries = new Map(); // id  -> { id, type, date, ts, data }
  const queue = new Map();   // pending writes: 'store|key' -> { store, key, record } (record null = delete)
  const listeners = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(DB_NAME) : null;
  let waiting = [];          // resolvers for the writes currently in the queue
  let timer = null;
  let conn = null;

  // ---------------------------------------------------------------- IndexedDB plumbing

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('entries')) {
          const store = d.createObjectStore('entries', { keyPath: 'id' });
          store.createIndex('type', 'type');
          store.createIndex('date', 'date');
          store.createIndex('type_date', ['type', 'date']);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => console.warn('[db] upgrade is waiting for other open tabs to close');
    });
  }

  function transaction(mode, work) {
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(['kv', 'entries'], mode);
      const result = work(tx.objectStore('kv'), tx.objectStore('entries'));
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  function load() {
    const out = {};
    return transaction('readonly', (kvStore, entryStore) => {
      kvStore.getAll().onsuccess = (e) => { out.kv = e.target.result; };
      entryStore.getAll().onsuccess = (e) => { out.entries = e.target.result; };
    }).then(() => {
      kv.clear();
      entries.clear();
      out.kv.forEach((r) => kv.set(r.key, r));
      out.entries.forEach((r) => entries.set(r.id, r));
    });
  }

  const ready = (typeof indexedDB === 'undefined' ? Promise.reject(new Error('IndexedDB is not available')) : open())
    .then((c) => {
      conn = c;
      // A newer version of the app opened the database in another tab: step aside and reload.
      conn.onversionchange = () => { conn.close(); location.reload(); };
      return load();
    })
    .catch((err) => {
      conn = null;
      console.warn('[db] IndexedDB unavailable, data will only live in memory on this page.', err);
    });

  let chain = ready; // every write runs after the previous one, in order

  function persist(store, key, record) {
    queue.set(store + '|' + key, { store, key, record });
    const saved = new Promise((resolve) => waiting.push(resolve));
    if (!timer) timer = setTimeout(flush, WRITE_DELAY);
    if (channel) channel.postMessage({ store, key, record });
    return saved;
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (queue.size) {
      const ops = Array.from(queue.values());
      const done = waiting;
      queue.clear();
      waiting = [];
      chain = chain
        .then(() => conn && transaction('readwrite', (kvStore, entryStore) => {
          ops.forEach((op) => {
            const store = op.store === 'kv' ? kvStore : entryStore;
            if (op.record) store.put(op.record);
            else store.delete(op.key);
          });
        }))
        .catch((err) => console.error('[db] save failed', err))
        .then(() => done.forEach((resolve) => resolve()));
    }
    return chain;
  }

  // Save before the page goes away (app switch, tab close, phone lock).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // Keep other open tabs/windows of the app in sync.
  if (channel) {
    channel.onmessage = (e) => {
      const m = e.data || {};
      if (m.reset) { load().then(() => emit({ store: '*', remote: true })); return; }
      const map = m.store === 'kv' ? kv : entries;
      if (m.record) map.set(m.key, m.record);
      else map.delete(m.key);
      emit({ store: m.store, key: m.key, remote: true });
    };
  }

  function emit(change) {
    listeners.forEach((fn) => {
      try { fn(change); } catch (err) { console.error(err); }
    });
  }

  function copy(value) {
    if (value === null || typeof value !== 'object') return value;
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  // ---------------------------------------------------------------- kv: settings & current state

  function get(key, fallback) {
    const r = kv.get(key);
    return copy(r ? r.value : fallback);
  }

  function set(key, value) {
    const record = { key, value: copy(value), updatedAt: Date.now() };
    kv.set(key, record);
    emit({ store: 'kv', key });
    return persist('kv', key, record);
  }

  function del(key) {
    if (!kv.has(key)) return Promise.resolve();
    kv.delete(key);
    emit({ store: 'kv', key });
    return persist('kv', key, null);
  }

  // ---------------------------------------------------------------- entries: the tracking log

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Add an entry. opts.date / opts.ts let you back-date it (e.g. demo data).
  function add(type, data, opts) {
    opts = opts || {};
    const ts = opts.ts || Date.now();
    const entry = { id: uid(), type, date: opts.date || isoDate(new Date(ts)), ts, data: copy(data || {}) };
    entries.set(entry.id, entry);
    emit({ store: 'entries', key: entry.id, type });
    return persist('entries', entry.id, entry).then(() => copy(entry));
  }

  function matches(e, type, f) {
    if (type && e.type !== type) return false;
    if (!f) return true;
    if (typeof f === 'function') return f(e);
    if (f.date && e.date !== f.date) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (f.match) {
      for (const k in f.match) if (!e.data || e.data[k] !== f.match[k]) return false;
    }
    if (f.where && !f.where(e)) return false;
    return true;
  }

  // Entries of a type (or all types when type is null), newest first.
  function list(type, filter) {
    let out = [];
    entries.forEach((e) => { if (matches(e, type, filter)) out.push(e); });
    out.sort((a, b) => b.ts - a.ts);
    if (filter && filter.limit) out = out.slice(0, filter.limit);
    return out.map(copy);
  }

  function latest(type, filter) {
    return list(type, filter)[0] || null;
  }

  // Replace an entry's data.
  function update(id, data) {
    const e = entries.get(id);
    if (!e) return Promise.resolve(null);
    const next = Object.assign({}, e, { data: copy(data), updatedAt: Date.now() });
    entries.set(id, next);
    emit({ store: 'entries', key: id, type: e.type });
    return persist('entries', id, next).then(() => copy(next));
  }

  // One entry per day (and per opts.key fields): update it if it exists, otherwise add it.
  //   db.upsert('daily-reflection', data)                          one per day
  //   db.upsert('tracker', { param: 'focus', value: 7 }, { key: 'param', date })   one per param per day
  function upsert(type, data, opts) {
    opts = opts || {};
    const date = opts.date || today();
    const match = {};
    [].concat(opts.key || []).forEach((k) => { match[k] = data[k]; });
    const existing = latest(type, { date, match });
    return existing ? update(existing.id, data) : add(type, data, { date });
  }

  function remove(idOrEntry) {
    const id = idOrEntry && typeof idOrEntry === 'object' ? idOrEntry.id : idOrEntry;
    const e = entries.get(id);
    if (!e) return Promise.resolve();
    entries.delete(id);
    emit({ store: 'entries', key: id, type: e.type });
    return persist('entries', id, null);
  }

  // ---------------------------------------------------------------- whole-database helpers

  function exportAll() {
    return {
      app: DB_NAME,
      version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      kv: Array.from(kv.values()).map(copy),
      entries: list(null),
    };
  }

  // Replace everything with `data` (an object from db.export()). db.clear() is db.import({}).
  function importAll(data) {
    data = data || {};
    flush();
    kv.clear();
    entries.clear();
    (data.kv || []).forEach((r) => { if (r && r.key != null) kv.set(r.key, copy(r)); });
    (data.entries || []).forEach((r) => { if (r && r.id) entries.set(r.id, copy(r)); });
    emit({ store: '*' });
    chain = chain
      .then(() => conn && transaction('readwrite', (kvStore, entryStore) => {
        kvStore.clear();
        entryStore.clear();
        kv.forEach((r) => kvStore.put(r));
        entries.forEach((r) => entryStore.put(r));
      }))
      .then(() => { if (channel) channel.postMessage({ reset: true }); });
    return chain;
  }

  // Re-read everything from IndexedDB (e.g. when a page comes back from the back/forward cache).
  function reload() {
    return flush().then(() => conn && load()).then(() => emit({ store: '*' }));
  }

  // ---------------------------------------------------------------- dates ('YYYY-MM-DD', local time)

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function toDate(s) { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return isoDate(new Date()); }
  function addDays(date, n) { const d = toDate(date); d.setDate(d.getDate() + n); return isoDate(d); }
  // Monday of the week containing `date`.
  function weekStart(date) { const d = toDate(date || today()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDate(d); }
  function range(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
  // db.format('2026-09-22', { weekday: 'short', month: 'short', day: 'numeric' }) -> 'Tue, Sep 22'
  function format(date, opts) { return toDate(date).toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric' }); }
  // 'SEP 15 – 21' or 'SEP 29 – OCT 5'
  function weekLabel(start) {
    const end = addDays(start, 6);
    const tail = start.slice(0, 7) === end.slice(0, 7) ? String(toDate(end).getDate()) : format(end);
    return (format(start) + ' – ' + tail).toUpperCase();
  }

  window.db = {
    ready,
    // kv
    get, set, del,
    keys: () => Array.from(kv.keys()).sort(),
    // entries
    add, list, latest, upsert, update, remove,
    // lifecycle
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    flush, reload,
    export: exportAll,
    import: importAll,
    clear: () => importAll({}),
    // dates
    today, addDays, weekStart, range, format, weekLabel, toDate,
    iso: isoDate, // Date -> 'YYYY-MM-DD'
  };
})();
