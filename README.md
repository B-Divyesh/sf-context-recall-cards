# Context Recall Cards

Context Recall Cards is a private, offline-first vocabulary practice app for independent language learners who recognize words in an app but struggle to retrieve them in a real sentence.

Instead of generic flashcards, each card begins with a sentence the learner actually read, heard, or wanted to say. The app brings it back through a short **listen → cloze → speak** sequence, with optional personal pronunciation recordings and self-assessed spaced review.

Live product: <https://context-recall-cards.sociobot.in>

## What v1 includes

- Learner-written word or phrase, sentence, meaning, language, and source
- Optional microphone recording stored as a Blob in IndexedDB
- Listen, cloze, and speak-back prompts with adaptive due dates
- Searchable library, editing, deletion confirmation, and review history
- JSON export/import including audio, with last-write-wins merging
- Installable PWA, precached production shell, offline fallback, and update notice
- Free field book with 25 contexts and 5 recordings
- $12 one-time Sociobot license unlock for unlimited contexts and recordings
- Local license restore and once-daily verification cache
- Standalone privacy and terms pages

There is deliberately no login, cloud sync, AI-generated content, social feed, speech score, analytics, or third-party runtime script/font.

## Develop

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

The development server is shown in the terminal. Service-worker registration is production-only so normal development is not affected by stale caches.

## Test and build

```sh
npm test
npm run build
npm run test:e2e
```

- `npm test` runs scheduler/helper unit tests.
- `npm run build` type-checks and creates the deployable static site in `dist/`, with `dist/index.html` at its root.
- `npm run test:e2e` builds and previews the production app, then runs the full creation/practice/persistence/offline flow and axe checks in desktop Chromium and a 393px mobile viewport.

Preview the exact production output with `npm run preview` after building.

## Data and billing

Learning data stays in the browser's `context-recall-cards` IndexedDB database. The license token and its cached verdict use the `sb_license:context-recall-cards` and `sb_license_verdict:context-recall-cards` localStorage keys.

Production billing defaults to `https://api.sociobot.in/api/v1`. For a registered staging product, build with:

```sh
VITE_BILLING_BASE_URL=https://pilot-api.sociobot.in/api/v1 npm run build
```

The repository contains no product ID or payment-provider integration. Sociobot registers the slug and hosts checkout.

## Deploy

Deploy the contents of `dist/` as a static site. Serve `/privacy/` and `/terms/` as directory indexes, serve `manifest.webmanifest` with a manifest MIME type, and avoid long-lived caching for `sw.js`. The app shell assets themselves are explicitly versioned and precached.

The product brief is in [`.factory/brief.json`](.factory/brief.json), the visual system and generated-art provenance are in [`.factory/design.md`](.factory/design.md), and verification notes are in [`.factory/handoff.md`](.factory/handoff.md).

## License

MIT. See [LICENSE](LICENSE).
