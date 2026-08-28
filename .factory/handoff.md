# Handoff — Context Recall Cards v1

## Built

- A complete vanilla TypeScript/Vite local-first PWA for learner-authored vocabulary contexts.
- Card capture with target-in-sentence validation, language/source/meaning metadata, and optional browser microphone recording.
- A persisted listen → cloze → speak practice cycle with self-grading, adaptive due dates, and per-card review history.
- Today queue, complete/rest and first-use states, searchable library, editing, deletion confirmation, keyboard navigation, and responsive 393px bottom navigation.
- IndexedDB storage for structured data and audio Blobs. JSON backup export includes audio only after explicit confirmation; import validates the product/version and merges the newer edit.
- Production service worker with a versioned shell cache, runtime cache, offline fallback, update toast, `skipWaiting` message, and `clients.claim`. The cache ignores server `Vary` headers when matching local assets, verified against the production preview while fully offline.
- Install manifest with 192px, 512px, and maskable icons; matching splash colors.
- $12 one-time paid unlock using the Sociobot checkout and license contract. The free tier holds 25 contexts and 5 recordings; saved practice, accessibility, delete, and export are never gated. The billing base URL can be switched at build time without a product ID.
- Privacy and terms pages, MIT license, complete README, and no analytics, CDN assets, accounts, or third-party runtime requests.
- Original cinematic hero art generated via the factory Azure image tool, manually reviewed for text/brand/anatomy artifacts, and optimized to 20 KB mobile / 64 KB desktop WebP. Full source and prompt provenance are in `assets/src/` and `.factory/design.md`.

## Verification (2026-08-28)

- `npm test`: 6/6 unit tests pass.
- `npm run build`: passes; reproducibly emits `dist/index.html`.
- `npm run test:e2e`: 10/10 pass across desktop Chromium and Pixel 5 (393px). Covers create, validation, cloze recall, grading, IndexedDB persistence, production-shell byte assertion, explicit offline reload, export/import, paid-license return/verification, and axe serious/critical scan.
- `npm audit --omit=dev`: 0 production vulnerabilities. Full dependency audit: 0 vulnerabilities.
- Production payload: 29.86 KB JS / 19.43 KB CSS uncompressed (11.00 KB / 5.23 KB gzip); no runtime font bytes; largest hero 63.64 KB. All are below the 200 KB JS, 50 KB CSS, 120 KB fonts, and 300 KB hero budgets.
- Lighthouse mobile against `npm run preview`: Performance 100, Accessibility 100, Best Practices 100, SEO 100. LCP 1.5 s, total blocking time 0 ms, CLS 0. Console-errors audit passed.
- Factory `verify-url.sh`: 200 response, 628 ms network-idle load, correct title/lang, exactly one h1, main landmark present, no missing alt text, no unlabeled buttons, and no console errors.
- Generated hero visually inspected at source resolution. Desktop and Pixel 5 screenshots reviewed after the production build.

## Run and deploy

```sh
npm install
npm test
npm run build
npm run test:e2e
```

Deploy `dist/` as the static root. Do not cache `sw.js` long-term. The factory must register the `context-recall-cards` paid product before exercising hosted checkout. Use `VITE_BILLING_BASE_URL=https://pilot-api.sociobot.in/api/v1` for registered staging billing; production is the default.

## Known gaps and next steps

- Live purchase and refund/revocation could not be exercised before factory product registration; client behavior follows the provided contract and remains non-blocking offline.
- Microphone formats and permissions depend on browser support and a secure deployed origin. Unsupported/denied cases are explained and do not block text practice.
- Scheduling is intentionally transparent and self-assessed; there is no speech scoring or sync claim. A future pilot should measure the brief's four-week target (30+ contexts and delayed spoken recall for at least 70%) before tuning intervals.
