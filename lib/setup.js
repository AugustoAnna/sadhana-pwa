/*
 * setup.js — data setup that runs when the app starts (support.js calls setup.run()).
 *
 *   1. Converts data saved with the first version's practice ids (see content.legacyPracticeIds).
 *   2. On a brand-new install, adds mock history so Home's progress view has something to show.
 *      Every mock entry has data.demo = true; Dev.html can remove it or load it again.
 *      In the mock history, mood and energy follow how much was practiced that day (Insights charts it).
 *   3. Replaces mock history made before that, once. Entries you logged yourself are never touched.
 *   4. Adds Shoonya, once, to a practice list saved before it became a default.
 */
(function () {
  'use strict';

  const SEEDED_FLAG = 'sadhana-pwa.demoSeeded'; // in localStorage, so erasing the database doesn't re-seed

  // ---------------------------------------------------------------- 1. practice id migration

  function migrateLegacyIds() {
    if (db.get('setup.version', 0) >= 2) return;
    const map = content.legacyPracticeIds;
    const to = (id) => map[id] || id;

    const selected = db.get('practices.selected', null);
    if (selected) db.set('practices.selected', [...new Set(selected.map(to))]);
    const reps = db.get('practices.reps', null);
    if (reps) db.set('practices.reps', Object.fromEntries(Object.entries(reps).map(([k, v]) => [to(k), v])));
    ['fields.', 'schedule.'].forEach((prefix) => {
      Object.keys(map).forEach((old) => {
        const value = db.get(prefix + old, undefined);
        if (value === undefined) return;
        if (db.get(prefix + map[old], undefined) === undefined) db.set(prefix + map[old], value);
        db.del(prefix + old);
      });
    });
    ['practice', 'practice-log'].forEach((type) => {
      db.list(type).forEach((e) => {
        if (map[e.data.practice]) db.update(e.id, { ...e.data, practice: map[e.data.practice] });
      });
    });
    db.set('setup.version', 2);
  }

  // ---------------------------------------------------------------- 2. mock history

  const SAMPLE = {
    crash: ['Twice: morning and after lunch.', 'Once, before the work call.', 'Three times; it helped in the afternoon slump.'],
    eating: ['Ate slowly, without the phone.', 'Rushed lunch; dinner was better.', 'Noticed I was full earlier than usual.'],
    sleep: ['In bed by 10:30, up at 5:30.', 'Late night again; woke up tired.', 'Slept well and woke before the alarm.'],
    tools: [
      'Caught myself blaming the traffic, then let it go.',
      'Took responsibility for a missed deadline instead of explaining it away.',
      'The meeting ran long; I stayed with it without fighting it.',
      'Watched the irritation come and go.',
      'Helped a stranger with directions and it felt good.',
    ],
    weekly: [
      'Steadier than last week; my back feels stronger.',
      'Mostly. I missed one morning but made it up in the evening.',
      'Energy is more even through the afternoon.',
    ],
    expressions: [
      'A wonderful sit in the morning; the mind was very still.',
      'Finally did 12 Surya Shaktis without stopping.',
      'Rain during Isha Kriya. Felt completely at ease.',
      'Chanted AUM with the family tonight.',
      'A deep quiet after Shoonya that stayed for hours.',
    ],
  };
  const EXTRA = ['shoonya', 'sukha-kriya', 'aum-chanting', 'sadhguru-presence', 'surya-kriya', 'nadi-shuddhi'];
  const TOOLS = ['t1', 't2', 't3', 't4', 't5'];
  const TOOL_NAMES = {
    t1: 'All the rules are my rules',
    t2: 'I am responsible for everything',
    t3: 'This moment is inevitable',
    t4: 'I am not this body; I am not this mind',
    t5: 'I am a Mother to the World',
  };

  // Five weeks of daily practice ending yesterday, with journal entries along the way.
  function seedDemo(options) {
    if (options && options.replace) removeDemo();
    const today = db.today();
    const days = (options && options.days) || 35;
    const selected = db.get('practices.selected', content.defaultPractices);
    const params = db.get('tracker.params', content.trackerParams);
    const questions = db.get('reflection.daily', content.dailyQuestions);
    const weeklyQuestions = db.get('reflection.weekly', content.weeklyQuestions);
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = (list) => list[rnd(0, list.length - 1)];
    const chance = (p) => Math.random() < p;
    const tag = () => pick([null, null, 'star', 'ladder', 'lotus', 'spiral', 'balance', 'eye']);
    const answerFor = (q) =>
      /crash course/i.test(q) ? pick(SAMPLE.crash) : /eat/i.test(q) ? pick(SAMPLE.eating) : /sleep/i.test(q) ? pick(SAMPLE.sleep) : pick(SAMPLE.tools);
    const trackerValue = (format) => ({
      arrow: pick(['up', 'up', 'same', 'down']),
      rating: rnd(5, 9),
      check: chance(0.75) ? 'yes' : 'no',
      yesno: chance(0.75) ? 'yes' : 'no',
      stars: rnd(2, 5),
      percent: rnd(50, 100),
      duration: rnd(10, 60),
      number: rnd(12, 16) / 2,
    })[format] ?? rnd(1, 10);

    // Days you logged yourself keep your entries: no mock entry of the same kind is added next to them.
    const mine = new Set(db.list(null, { where: (e) => !(e.data && e.data.demo) }).map((e) => e.type + '|' + e.date));
    const logged = (type, date) => mine.has(type + '|' + date);

    // How much you practice drifts from day to day (good stretches, slumps, the odd off day), and
    // mood and energy follow it, so Insights shows the two moving together.
    const full = selected.reduce((sum, id) => sum + ((content.practice(id) || {}).minutes || 0), 0) || 60;
    let rhythm = 0.75;

    for (let i = days; i >= 1; i--) {
      const date = db.addDays(today, -i);
      const at = (h, m) => db.toDate(date).getTime() + (h * 60 + (m || 0)) * 60000;
      const add = (type, data, ts) => db.add(type, { ...data, demo: true }, { date, ts });
      rhythm = Math.min(1, Math.max(0.15, rhythm + (Math.random() - 0.5) * 0.5));
      const effort = chance(0.12) ? 0.1 : rhythm;

      // Practices: each selected one with a chance that follows the day's effort, plus an
      // occasional extra. At least one every day.
      let minutes = 0;
      if (logged('practice', date)) {
        minutes = stats.minutes(date);
      } else {
        let done = selected.filter(() => chance(0.1 + 0.9 * effort));
        if (!done.length) done = [selected[0] || 'isha-kriya'];
        EXTRA.forEach((id) => { if (!done.includes(id) && chance(0.35 * effort)) done.push(id); });
        done.forEach((id, k) => {
          const p = content.practice(id);
          if (!p) return;
          add('practice', { practice: id, minutes: p.minutes }, at(5, 30 + k * 25));
          minutes += p.minutes;
        });
      }

      // Evening check-in: mood (0-4) and energy (1-5) rise with the minutes practiced, give or take.
      if (!logged('mood', date)) {
        const share = Math.min(1, minutes / full);
        const jitter = () => (Math.random() - 0.5) * 1.4;
        const mood = Math.min(4, Math.max(0, Math.round(share * 4 + jitter())));
        const energy = Math.min(5, Math.max(1, Math.round(1 + share * 4 + jitter())));
        add('mood', { mood, moodLabel: ['Low', 'Down', 'Okay', 'Good', 'Great'][mood], energy }, at(20, 15));
      }
      if (!logged('tracker', date)) {
        params.forEach((p) => { if (chance(0.85)) add('tracker', { param: p.id, value: trackerValue(p.format) }, at(21)); });
      }

      if (!logged('daily-reflection', date) && chance(0.65)) {
        const answers = questions.filter(() => chance(0.7)).map((q) => ({ key: 'q:' + q, kind: 'param', question: q, text: answerFor(q), tag: tag() }));
        const tool = pick(TOOLS);
        answers.push({ key: tool, kind: 'tool', question: TOOL_NAMES[tool], text: pick(SAMPLE.tools), tag: tag() });
        add('daily-reflection', { answers }, at(21, 30));
      }
      if (chance(0.25)) add('expression', { text: pick(SAMPLE.expressions), tag: tag() }, at(19, rnd(0, 50)));

      // A weekly reflection on each Sunday, filed under that week's Monday.
      if (db.toDate(date).getDay() === 0 && !logged('weekly-reflection', db.weekStart(date))) {
        const week = db.weekStart(date);
        const answers = weeklyQuestions.map((q, n) => ({ key: 'q:' + q, question: q, text: SAMPLE.weekly[n % SAMPLE.weekly.length], tag: tag() }));
        db.add('weekly-reflection', { week, answers, demo: true }, { date: week, ts: at(20) });
      }
    }
  }

  function removeDemo() {
    db.list(null, { where: (e) => e.data && e.data.demo }).forEach((e) => db.remove(e.id));
  }

  // ---------------------------------------------------------------- 3. mock history made before v3

  // Older mock data had random moods; replace it once so mood follows practice.
  function refreshDemo() {
    if (db.get('setup.version', 0) >= 3) return;
    if (db.list(null, { where: (e) => e.data && e.data.demo, limit: 1 }).length) seedDemo({ replace: true });
    db.set('setup.version', 3);
  }

  // ---------------------------------------------------------------- 4. Shoonya in saved lists

  // A list saved on Add Practices replaces content.defaultPractices, so lists saved before Shoonya
  // was a default don't have it. Add it once, where the defaults have it: after Shambhavi.
  function addShoonya() {
    if (db.get('setup.version', 0) >= 4) return;
    const selected = db.get('practices.selected', null);
    if (selected && !selected.includes('shoonya')) {
      const list = selected.slice();
      const after = list.indexOf('shambhavi');
      const before = list.indexOf('surya-kriya');
      list.splice(after >= 0 ? after + 1 : before >= 0 ? before : list.length, 0, 'shoonya');
      db.set('practices.selected', list);
    }
    db.set('setup.version', 4);
  }

  function seedOnFirstRun() {
    let seeded = null;
    try { seeded = localStorage.getItem(SEEDED_FLAG); } catch (err) { /* storage blocked */ }
    if (seeded) return;
    if (db.list(null).length === 0) seedDemo();
    try { localStorage.setItem(SEEDED_FLAG, '1'); } catch (err) { /* storage blocked */ }
  }

  window.setup = {
    run() {
      migrateLegacyIds();
      refreshDemo();
      addShoonya();
      seedOnFirstRun();
    },
    seedDemo,
    removeDemo,
  };
})();
