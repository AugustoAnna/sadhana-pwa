/*
 * reminders.js — two daily practice reminders (global `reminders`), set from the bell on Home.
 *
 * Settings live in the database (kv 'reminders'). Notifications are shown by this page while the
 * app is open: a web app can't wake itself up later. Reminders that arrive when the app is closed
 * need a server sending Web Push (the Sadhana Tracker app does that with a Supabase function).
 */
(function () {
  'use strict';

  const ICON = new URL('../icons/icon-192.png', document.currentScript.src).href;
  const DEFAULTS = [
    { id: 1, label: 'Morning reminder', time: '06:00', enabled: false },
    { id: 2, label: 'Evening reminder', time: '18:00', enabled: false },
  ];
  let timers = [];

  function list() {
    const saved = db.get('reminders', []);
    return DEFAULTS.map((d) => ({ ...d, ...(saved.find((s) => s.id === d.id) || {}) }));
  }

  function update(id, patch) {
    db.set('reminders', list().map((r) => (r.id === id ? { ...r, ...patch } : r)).map(({ id, time, enabled }) => ({ id, time, enabled })));
    schedule();
  }

  // 'granted' | 'default' (not asked yet) | 'denied' | 'unsupported' (e.g. iPhone Safari outside the installed app)
  function permission() {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  }

  // Must be called from a tap: browsers only show the permission prompt for a user gesture.
  function requestPermission() {
    if (!('Notification' in window)) return Promise.resolve('unsupported');
    return Promise.resolve(Notification.requestPermission()).then((result) => {
      schedule();
      return result;
    });
  }

  function show(body, tag) {
    if (permission() !== 'granted') return Promise.resolve(false);
    const options = { body, tag, icon: ICON, badge: ICON };
    const viaWorker = 'serviceWorker' in navigator && navigator.serviceWorker.controller
      ? navigator.serviceWorker.ready.then((reg) => reg.showNotification('Sadhana Tracker', options))
      : Promise.reject(new Error('no service worker'));
    return viaWorker.then(() => true, () => {
      try { new Notification('Sadhana Tracker', options); return true; } catch (err) { return false; }
    });
  }

  function shownToday(id) {
    try { return localStorage.getItem('sadhana-pwa.reminderShown.' + id) === db.today(); } catch (err) { return false; }
  }

  function markShown(id) {
    try { localStorage.setItem('sadhana-pwa.reminderShown.' + id, db.today()); } catch (err) { /* storage blocked */ }
  }

  // Set a timer for each reminder still ahead today. support.js calls this on every screen.
  function schedule() {
    timers.forEach(clearTimeout);
    timers = [];
    if (permission() !== 'granted') return;
    const now = new Date();
    list().filter((r) => r.enabled).forEach((r) => {
      const [h, m] = r.time.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
      if (at > now) {
        timers.push(setTimeout(() => {
          if (shownToday(r.id)) return;
          markShown(r.id);
          show('It’s time for your practice.', 'reminder-' + r.id);
        }, at - now));
      }
    });
  }

  window.reminders = {
    list,
    update,
    permission,
    requestPermission,
    schedule,
    test: () => show('This is how your practice reminders will look.', 'reminder-test'),
    anyOn: () => permission() === 'granted' && list().some((r) => r.enabled),
  };
})();
