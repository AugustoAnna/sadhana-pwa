/*
 * content.js — static content shared by several screens. Plain data: edit freely.
 * What you do in the app (ticks, reflections, settings) lives in IndexedDB via db.js, not here.
 * Values marked "default" are only used until you change them in the app.
 */
(function () {
  'use strict';

  // Practice catalog, from the Sadhana Tracker app (src/data/catalogue.ts).
  // type: guided (has a guided recording) | timed (open-ended sit) | unguided (done on your own).
  // Guided and timed practices show a play button. `minutes` is logged when you tick one on Home.
  // Images live in images/practices/<id>.webp.
  const PRACTICES = [
    ['achala-arpanam', 'Achala Arpanam', 12, 'guided'],
    ['angamardana', 'Angamardana', 40, 'unguided'],
    ['ardhasiddhasana', 'Ardhasiddhasana', 20, 'timed'],
    ['aum-chanting', 'AUM Chanting', 20, 'timed'],
    ['bhakti-sadhana', 'Bhakti Sadhana', 13, 'unguided'],
    ['bhastrika-kriya', 'Bhastrika Kriya', 12, 'unguided'],
    ['bhuta-shuddhi', 'Bhuta Shuddhi', 10, 'unguided'],
    ['breath-watching', 'Breath Watching', 40, 'timed'],
    ['chit-shakti-health', 'Chit Shakti for Health', 19, 'guided'],
    ['chit-shakti-love', 'Chit Shakti for Love', 17, 'guided'],
    ['chit-shakti-peace', 'Chit Shakti for Peace', 19, 'guided'],
    ['chit-shakti-success', 'Chit Shakti for Success', 19, 'guided'],
    ['devi-sadhana', 'Devi Sadhana', 8, 'guided'],
    ['directional-movements', 'Directional Movements of the Arms', 6, 'guided'],
    ['eye-care', 'Eye Care Practices', 10, 'unguided'],
    ['guru-mahima', 'Guru Mahima', 6, 'unguided'],
    ['guru-pooja', 'Guru Pooja', 6, 'guided'],
    ['infinity-meditation', 'Infinity Meditation', 15, 'guided'],
    ['ie-crash-course', 'Inner Engineering Crash Course', 2, 'guided'],
    ['isha-kriya', 'Isha Kriya', 14, 'guided'],
    ['jala-neti', 'Jala Neti', 10, 'unguided'],
    ['knee-rotations', 'Knee Rotations', 2, 'unguided'],
    ['linga-bhairavi-arati', 'Linga Bhairavi Arati', 2, 'guided'],
    ['living-soil', 'Living Soil Meditation', 12, 'guided'],
    ['mahamantra', 'Mahamantra', 21, 'guided'],
    ['margazhi-mantra', 'Margazhi Mantra', 15, 'guided'],
    ['nada-yoga', 'Nada Yoga', 6, 'guided'],
    ['nadi-shuddhi', 'Nadi Shuddhi', 4, 'guided'],
    ['namaskar-process', 'Namaskar Process', 4, 'guided'],
    ['neck-practices', 'Neck Practices', 7, 'guided'],
    ['rudraksha-diksha', 'Rudraksha Diksha', 4, 'guided'],
    ['sadhguru-presence', "Sadhguru's Presence", 10, 'guided'],
    ['samyama', 'Samyama', 30, 'timed'],
    ['shakti-chalana', 'Shakti Chalana Kriya', 45, 'unguided'],
    ['shambhavi', 'Shambhavi Mahamudra Kriya', 21, 'unguided'],
    ['shambhavi-mudra', 'Shambhavi Mudra', 4, 'guided'],
    ['shanmuki-mudra', 'Shanmuki Mudra', 16, 'unguided'],
    ['shiva-namaskar', 'Shiva Namaskar', 10, 'unguided'],
    ['shoonya', 'Shoonya', 15, 'unguided'],
    ['simha-kriya', 'Simha Kriya', 3, 'unguided'],
    ['squatting', 'Squatting', 1, 'unguided'],
    ['sukha-kriya', 'Sukha Kriya', 20, 'timed'],
    ['surya-kriya', 'Surya Kriya', 15, 'unguided'],
    ['surya-shakti', 'Surya Shakti', 12, 'unguided'],
    ['thoppukarnam', 'Thoppukarnam', 2, 'unguided'],
    ['yoga-namaskar', 'Yoga Namaskar', 4, 'guided'],
    ['yogasanas', 'Yogasanas', 50, 'unguided'],
  ];
  const NO_IMAGE = ['chit-shakti-health', 'thoppukarnam'];
  // A plain beige square for the practices that have no illustration yet.
  const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#E9DFC9"/></svg>');

  // The 9 annotation symbols used on reflections and expressions (one per entry).
  // `svg` is the drawing on a 16x16 grid; C is replaced by the color.
  const SYMBOLS = [
    ['spiral', 'Look back later', 'Something to come back to and read again.',
      '<path d="M4 8a4 4 0 1 1 1.2 2.8" stroke="C" stroke-width="1.6" stroke-linecap="round"/><path d="M4 11v-2.5h2.5" stroke="C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['star', 'Done well', 'Something you did well.',
      '<path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 5.7l4-.6L8 1.5Z" stroke="C" stroke-width="1.2"/>'],
    ['ladder', 'Made progress', 'A step forward, however small.',
      '<rect x="2.5" y="9" width="2.4" height="3.5" rx="0.6" fill="C"/><rect x="6.3" y="6.5" width="2.4" height="6" rx="0.6" fill="C"/><rect x="10.1" y="4" width="2.4" height="8.5" rx="0.6" fill="C"/>'],
    ['noentry', 'No change', 'Nothing has shifted here yet.',
      '<circle cx="8" cy="8" r="6" stroke="C" stroke-width="1.4"/><line x1="4" y1="12" x2="12" y2="4" stroke="C" stroke-width="1.4"/>'],
    ['balance', 'Balance', 'You stayed steady and even.',
      '<line x1="3" y1="8" x2="13" y2="8" stroke="C" stroke-width="1.4"/><path d="M5 6l-2 2 2 2M11 6l2 2-2 2" stroke="C" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['lotus', 'Clarity', 'Something became clear.',
      '<ellipse cx="8" cy="4.5" rx="1.6" ry="2.6" stroke="C" stroke-width="1.1"/><ellipse cx="8" cy="11.5" rx="1.6" ry="2.6" stroke="C" stroke-width="1.1"/><ellipse cx="4.5" cy="8" rx="2.6" ry="1.6" stroke="C" stroke-width="1.1"/><ellipse cx="11.5" cy="8" rx="2.6" ry="1.6" stroke="C" stroke-width="1.1"/><circle cx="8" cy="8" r="1.3" stroke="C" stroke-width="1.1"/>'],
    ['bulb', 'Intensity', 'A moment of real intensity.',
      '<path d="M8 1.5a4 4 0 0 0-2 7.5c.5.4.8 1 .8 1.6v.4h2.4v-.4c0-.6.3-1.2.8-1.6A4 4 0 0 0 8 1.5Z" stroke="C" stroke-width="1.2"/><line x1="6.5" y1="13.2" x2="9.5" y2="13.2" stroke="C" stroke-width="1.2"/><line x1="6.8" y1="14.4" x2="9.2" y2="14.4" stroke="C" stroke-width="1.2"/>'],
    ['eye', 'Needs attention', 'Something to watch or work on.',
      '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" stroke="C" stroke-width="1.2"/><circle cx="8" cy="8" r="1.8" stroke="C" stroke-width="1.2"/>'],
    ['chat', 'Talk to facilitator', 'Bring this up with your facilitator.',
      '<path d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7l-3 2.5v-2.5H2.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" stroke="C" stroke-width="1.2" stroke-linejoin="round"/>'],
  ];

  window.content = {
    practices: PRACTICES.map(([id, name, minutes, type]) => ({
      id,
      name,
      minutes,
      type,
      image: NO_IMAGE.includes(id) ? PLACEHOLDER : '../images/practices/' + id + '.webp',
      reps: id === 'angamardana', // offers 1X / 2X on Add Practices
    })),

    // Shown first on Add Practices.
    commonPractices: [
      'guru-pooja', 'ie-crash-course', 'mahamantra', 'bhuta-shuddhi',
      'angamardana', 'surya-kriya', 'yogasanas', 'yoga-namaskar',
      'shakti-chalana', 'shambhavi', 'isha-kriya', 'breath-watching',
      'samyama', 'shoonya', 'devi-sadhana', 'sadhguru-presence',
    ],

    // Default "My practices" on Home, in display order.
    defaultPractices: [
      'mahamantra', 'angamardana', 'isha-kriya', 'devi-sadhana',
      'shakti-chalana', 'shambhavi', 'shoonya', 'surya-kriya',
    ],

    // Practice ids used by the first version of this app, renamed to the catalog's ids.
    // lib/setup.js converts saved data once.
    legacyPracticeIds: {
      bhuta: 'bhuta-shuddhi',
      breath: 'breath-watching',
      devi: 'devi-sadhana',
      guru: 'guru-pooja',
      crash: 'ie-crash-course',
      isha: 'isha-kriya',
    },

    symbols: SYMBOLS.map(([id, label, description, svg]) => ({ id, label, description, svg })),

    // Sadhguru's quote of the day, from the same API the Sadhguru app uses (?language_code=en&date=YYYY-MM-DD).
    // The Journal loads them live (lib/quotes.js); nothing is copied into this repo.
    quotesApi: 'https://quotes.isha.in/dmq/index.php/Webservice/fetchDailyQuote',

    // The "Watch: Sadhguru on Sadhana" button on Home plays this inside the app.
    // Paste a YouTube link (watch, youtu.be or embed URL). Empty = the button shows "coming soon".
    sadhanaVideo: {
      title: 'Sadhguru on Sadhana',
      url: 'https://www.youtube.com/watch?v=WtwQkjT4DGA', // "Is Sadhana the Answer? | Sadhguru Spot"
    },

    // Default questions for Daily / Weekly Reflection (editable on Reflection Parameters).
    dailyQuestions: [
      'How many times did I do the IE Crash Course today?',
      'How conscious was I while eating?',
      'How well did I stick to my sleep schedule?',
    ],
    weeklyQuestions: [
      'Am I more flexible, stronger, or steady in my practice this week?',
      'Am I able to keep myself committed to my sadhana?',
      'What shifted in my energy or mood this week?',
    ],

    // Default rows of the Daily Tracker grid (editable on Tracker Parameters).
    // format: arrow | rating | check | number | stars | yesno | percent | duration
    trackerParams: [
      { id: 'wake', time: '6 AM', name: 'Wake-up ease', format: 'arrow' },
      { id: 'flex', time: '7 AM', name: 'Yogasana flexibility', format: 'rating' },
      { id: 'speech', time: 'All day', name: 'Speech discipline', format: 'check' },
      { id: 'focus', time: '9 PM', name: 'Focus', format: 'rating' },
      { id: 'sleep', time: '10 PM', name: 'Sleep hours', format: 'number' },
    ],

    // Default "Experience" fields on Practice Detail, per practice id (falls back to `default`).
    // kind: number | stepper | rating10 | stars5 | yesno | trend
    practiceFields: {
      default: [
        { id: 'duration', label: 'Duration', kind: 'number', unit: 'min' },
        { id: 'intensity', label: 'Intensity', kind: 'rating10' },
      ],
      angamardana: [
        { id: 'duration', label: 'Duration', kind: 'number', unit: 'min' },
        { id: 'intensity', label: 'Intensity', kind: 'rating10' },
        { id: 'rounds', label: 'Rounds', kind: 'stepper', unit: 'rounds' },
      ],
    },

    // ---------------------------------------------------------------- helpers

    practice(id) {
      return this.practices.find((p) => p.id === id) || null;
    },

    // A symbol as an <img src>, e.g. content.symbolIcon('star', '#2F6B5E').
    symbolIcon(id, color) {
      const s = this.symbols.find((x) => x.id === id);
      if (!s) return '';
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">' +
        s.svg.replace(/"C"/g, '"' + (color || '#2F6B5E') + '"') + '</svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    // YouTube link -> embed URL that plays inline (null when no or unknown link).
    videoEmbedUrl(url) {
      const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
      return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&playsinline=1&rel=0&modestbranding=1' : null;
    },
  };
})();
