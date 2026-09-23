# Sadhana Tracker — PWA scratchpad

A small installable web app built from the Sadhana Tracker hackathon screens. Every screen is an
HTML file you can edit directly. Everything you do in the app is saved on the device in IndexedDB,
so the screens actually work: ticks, reflections, check-ins, tracker values and settings persist,
and Home and Insights are computed from that history.

## Run it

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765>. Any static file server works. There is no build step.

To install it on a phone, the app must be served over HTTPS (for example GitHub Pages). Then open it
in Safari or Chrome and choose "Add to Home Screen" / "Install app". Offline use and installing
need HTTPS or `localhost`. Over plain `http://` on your LAN the screens still work, but nothing is
cached for offline use.

## Folder layout

```
index.html              redirects to screens/Home.dc.html
manifest.webmanifest    app name, icons, start page
sw.js                   service worker (offline cache)
icons/                  app icons: the hand-drawn spiral on orange #F37021; illustration.png is
                        the cleaned drawing on a transparent background, for reuse in screens
lib/
  db.js                 the IndexedDB layer (global `db`)
  content.js            shared static content: practice catalog, default questions, tracker rows
  stats.js              shared numbers: streak, minutes, weekly summary
  pwa.css               makes the 390x844 artboards fill a phone / sit in a phone frame on desktop
  dc-runtime.js         Claude Design runtime that renders .dc.html files (vendor file, don't edit)
screens/
  support.js            loaded by every screen: PWA tags, db, runtime, navigation
  screens.json          list of screens (Dev page + offline cache use it)
  *.dc.html             the app screens
  Scratch.dc.html       a small working example to copy when you start a new screen
  Dev.html              "Screens & data": jump to any screen, inspect/export/import the database
```

## Editing screens

The `.dc.html` files use the same format Claude Design exports, so you can also drop in a fresh
export. A screen is:

- a template inside `<x-dc>…</x-dc>`. `{{name}}` inserts a value (a dotted name only, no
  expressions). `<sc-for list="{{items}}" as="it">` repeats, and `<sc-if value="{{flag}}">` shows
  or hides. Events are written `onClick="{{fn}}"`, `onInput="{{fn}}"`, `onKeyDown="{{fn}}"`.
- a logic class in `<script type="text/x-dc" data-dc-script>`:
  `class Component extends DCLogic { renderVals() { return { … } } }`. Compute everything the
  template needs in `renderVals()`. Use `this.state` / `this.setState` for UI-only state.

Every screen can use these globals: `db` (data), `content` (static content), `stats` (numbers) and
`nav` (navigation). Screens re-render by themselves when the database changes.

To add a screen: copy `Scratch.dc.html`, rename it, and add it to `screens/screens.json`. A plain
`.html` page works too: include `<script src="./support.js"></script>` and wait for `appReady`
before using `db` (see `Dev.html`).

Navigation: links are ordinary `<a href="Other.dc.html">`. Links with `aria-label="Back"` or
`"Close"`, or with a `data-back` attribute, go back in history. Before any link leaves a screen,
pending database writes are saved. In code, use `nav.back('Fallback.dc.html')` and
`nav.go('Screen.dc.html')`. `nav.param('p')` reads `?p=` from the URL (Practice Detail and
Schedule use it for the practice id).

## The database

IndexedDB database `sadhana-pwa`, with two stores:

| Store | Shape | Use |
|---|---|---|
| `kv` | `{ key, value, updatedAt }` | settings and current state. `db.get(key, fallback)`, `db.set(key, value)`, `db.del(key)` |
| `entries` | `{ id, type, date, ts, data }` | a time-stamped log of what you did. `db.add(type, data)`, `db.list(type, filter)`, `db.latest(type, filter)`, `db.upsert(type, data, { key, date })`, `db.update(id, data)`, `db.remove(id)` |

Filters: `{ date, from, to, match: { field: value }, where: (e) => bool, limit }`. `date` is a
local day, `'YYYY-MM-DD'`. `db.list` returns newest first. Date helpers: `db.today()`,
`db.addDays()`, `db.weekStart()`, `db.range()`, `db.format()`, `db.weekLabel()`.

When a page opens, everything is read into memory, so reads are instant and synchronous. Writes
update memory right away and are saved in one batched transaction a moment later. `db.flush()`
waits until they are on disk.

What the screens store:

| Screen | kv keys | entry types |
|---|---|---|
| Home | | `practice` `{ practice, minutes }` (one per tick) |
| Add Practices | `practices.selected`, `practices.reps` | |
| Practice Detail | `fields.<practice>` | `practice-log` `{ practice, values, notes }`, also ticks `practice` |
| Schedule | `schedule.<practice>` | |
| Mood & Energy | | `mood` `{ mood, moodLabel, energy }` |
| Daily Reflection | `draft.dailyReflection` | `daily-reflection` `{ answers: [{ key, kind, question, text, tag }] }` |
| Weekly Reflection | `draft.weeklyReflection` | `weekly-reflection` `{ week, answers }` (dated the Monday) |
| Reflection Parameters | `reflection.daily`, `reflection.weekly` | |
| Daily Tracker | | `tracker` `{ param, value }` (one per row per day) |
| Tracker Parameters | `tracker.params` | |
| Expressions | `draft.expression` | `expression` `{ text, tag }` |
| My Commitment | `commitment` | |
| Scratch | `scratch.count` | `scratch-note` `{ text }` |
| Dev | `dev.handle` | |

Open **Screens & data** (the thin tab on the left edge of every screen on a phone, or the pill at
the top left on desktop) to browse all of it, edit values, export or import a JSON backup, load
demo data, or erase everything. You can also inspect it in the browser's DevTools under
Application → IndexedDB.

## Offline and updates

`sw.js` pre-caches every file listed in `screens/screens.json`. While you are online, screens are
always fetched fresh, so an edit shows up on the next reload. Offline, the cached copy is used. If
you change `sw.js` itself, bump `VERSION` so installed copies drop their old cache.

## Not built yet

- Reminders on the Schedule screen are saved but not sent (web push needs a server).
- There's no in-app history view for past reflections and expressions yet. The data is stored;
  the backlog still has an open question about how to show it.
- Data lives on one device. Use Export/Import on the Dev page to move it.
