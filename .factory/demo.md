# Demo sandbox

- URL: <https://context-recall-cards.sociobot.in/demo> (local: <http://127.0.0.1:4173/demo>).
- One click from the landing page opens three due contexts: `último` from a bus stop, `encore` from a café, and `ゆっくり` from a conversation class.
- Demo cards and recordings use the separate IndexedDB database `demo:context-recall-cards`. Demo license state uses `demo:sb_license:*` localStorage keys. The app neither reads nor writes the real `context-recall-cards` database while `/demo` is open.
- **Reset demo** replaces all demo changes with the three original contexts.
- **Start for real** deletes the demo database and demo license keys, then opens the real field book.
- The service worker caches `/demo`, so the sample field book remains available during the offline claim test after one online visit.
