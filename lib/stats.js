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

  // Progress calendar colors, from the Sadhana Tracker app (src/data/heatmap.ts, src/utils/monthCalendar.ts):
  // 12 shades for minutes practiced in a day, and three neutral states.
  const SHADES = ['#C2EBDC', '#9EE0C9', '#7CD5B6', '#5DCAA5', '#45BE96', '#31B188',
    '#22A47B', '#17966F', '#0F8764', '#0A7659', '#07634D', '#044034'];
  const BAND_TOP = [5, 10, 15, 20, 30, 45, 60, 95, 135, 180, 239, Infinity]; // minutes, upper bound per shade
  const NOT_YET = '#EDE5D6';         // future day
  const BEFORE_TRACKING = '#E4DBCA'; // before your first logged practice
  const NO_PRACTICE = '#DCD3C0';
  const TODAY_RING = '#FFBD31';
  const shade = (minutes) => SHADES[Math.max(0, BAND_TOP.findIndex((top) => Math.max(1, Math.round(minutes)) <= top))];

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

    // All-time totals: days with at least one practice, and minutes practiced.
    totals() {
      const all = db.list('practice');
      return { days: new Set(all.map((e) => e.date)).size, minutes: sumMinutes(all) };
    },

    shades: SHADES,

    // One block per month, from the month of your first practice through this month.
    // Each cell: { col, row (1-based, rows Monday..Sunday), fill, ring, title }.
    calendarMonths() {
      const today = db.today();
      const minutes = {};
      db.list('practice').forEach((e) => { minutes[e.date] = (minutes[e.date] || 0) + (Number(e.data.minutes) || 0); });
      const first = Object.keys(minutes).sort()[0] || null;
      const now = db.toDate(today);
      const from = first ? db.toDate(first) : now;
      const months = [];
      for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= now; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
        const offset = (m.getDay() + 6) % 7; // Monday = 0
        const length = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        const cells = [];
        for (let d = 1; d <= length; d++) {
          const date = db.iso(new Date(m.getFullYear(), m.getMonth(), d));
          const practiced = date in minutes;
          const fill = date > today ? NOT_YET
            : first && date < first ? BEFORE_TRACKING
            : practiced ? shade(minutes[date])
            : NO_PRACTICE;
          cells.push({
            col: Math.floor((d - 1 + offset) / 7) + 1,
            row: ((d - 1 + offset) % 7) + 1,
            fill,
            ring: date === today ? 'inset 0 0 0 2px ' + TODAY_RING : 'none',
            title: db.format(date, { weekday: 'short', month: 'short', day: 'numeric' }) +
              (practiced ? ' · ' + minutes[date] + ' min' : date > today ? '' : ' · no practice'),
          });
        }
        months.push({
          label: m.toLocaleDateString('en-US', m.getFullYear() === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' }),
          columns: cells[cells.length - 1].col,
          cells,
        });
      }
      return months;
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
