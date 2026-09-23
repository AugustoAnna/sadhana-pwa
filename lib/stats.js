/*
 * stats.js — numbers shared by several screens (Home, Insights, Weekly Reflection).
 * Everything is computed from what's in the database, so it always matches what you logged.
 */
(function () {
  'use strict';

  // Entry types that count as "journal entries".
  const JOURNAL = ['daily-reflection', 'weekly-reflection', 'expression'];

  const selected = () => db.get('practices.selected', content.defaultPractices);
  const sumMinutes = (list) => list.reduce((sum, e) => sum + (Number(e.data.minutes) || 0), 0);

  window.stats = {
    // Days in a row with at least one practice, ending today (or yesterday, if today is still empty).
    streak() {
      const days = new Set(db.list('practice').map((e) => e.date));
      const today = db.today();
      let n = 0;
      for (let d = days.has(today) ? today : db.addDays(today, -1); days.has(d); d = db.addDays(d, -1)) n++;
      return n;
    },

    // Minutes practiced on a day.
    minutes(date) {
      return sumMinutes(db.list('practice', { date }));
    },

    // Share (0..1) of your selected practices done on a day.
    dayRatio(date) {
      const total = selected().length;
      if (!total) return 0;
      const done = new Set(db.list('practice', { date }).map((e) => e.data.practice));
      return Math.min(1, done.size / total);
    },

    // Summary of the week starting `start` (a Monday), counting only days up to today.
    week(start) {
      const end = db.addDays(start, 6);
      const today = db.today();
      const days = db.range(start, end < today ? end : today).length;
      const practices = db.list('practice', { from: start, to: end });
      const journalDays = new Set(
        db.list(null, { from: start, to: end, where: (e) => JOURNAL.includes(e.type) }).map((e) => e.date)
      );
      return {
        days,
        done: practices.length,
        possible: selected().length * days,
        avgMinutes: days ? Math.round(sumMinutes(practices) / days) : 0,
        journalDays: journalDays.size,
      };
    },
  };
})();
