/*
 * content.js — static content shared by several screens. Plain data: edit freely.
 * What you do in the app (ticks, reflections, settings) lives in IndexedDB via db.js, not here.
 * Values marked "default" are only used until you change them in the app.
 */
window.content = {
  // Practice catalog. Add Practices lists all of these; Home shows the ones you picked.
  // `minutes` is what gets logged when you tick the practice on Home (null = not set yet).
  practices: [
    { id: 'angamardana', name: 'Angamardana', minutes: 40, color: '#7A2E33', reps: true },
    { id: 'bhuta', name: 'Bhuta Shuddhi', minutes: null, color: '#0E0D0B' },
    { id: 'breath', name: 'Breath Watching', minutes: null, color: '#3E6B7A' },
    { id: 'devi', name: 'Devi Sadhana', minutes: 8, color: '#6E6B63' },
    { id: 'guru', name: 'Guru Pooja', minutes: null, color: '#0E0D0B' },
    { id: 'crash', name: 'Inner Engineering Crash Course', minutes: null, color: '#B8946A' },
    { id: 'isha', name: 'Isha Kriya', minutes: 14, color: '#E8A16B' },
    { id: 'mahamantra', name: 'Mahamantra', minutes: 21, color: '#0E0D0B' },
  ],

  // Default "My practices" on Home, in display order.
  defaultPractices: ['mahamantra', 'angamardana', 'isha', 'devi'],

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
};
