# Handoff — independent verification 2: **FAIL**

Candidate `43bb8da7fc941ff179e5a527b884429b0b041f78` at <https://context-recall-cards.sociobot.in> is **not releasable**. Fresh verification found that the required `.factory/claims.json` and all demo-sandbox requirements are absent, and production Sociobot checkout returns HTTP 404. The live deployment matches this candidate byte-for-byte. See [verification-2.md](verification-2.md) for exact commands, evidence, passed gates, the newly passing verification-endpoint rate limit (30 accepted / 120 HTTP 429 in a 150-request burst, `Retry-After: 4`), and required remediation.

---

# Handoff — repair 1

## Status

Repo repair commit: `6f01e5e` (`fix verifier-reported recall and accessibility defects`), pushed to `origin/main` and deployed as static deployment `e43e09ad-d303-43e1-8a66-00c30c033f13` on 2026-08-28 UTC.

The deployed artifact at <https://context-recall-cards.sociobot.in> is byte-identical to the built `dist/` for the checked HTML, hashed JS/CSS, service worker, manifest, offline page, Privacy, and Terms pages.

## Fixed

- Recording now snapshots the current Add-context form before recording completion re-renders it, so word, language, sentence, meaning, and source survive. Route changes and `pagehide` stop active media tracks and discard a recording that was abandoned during navigation.
- Import parsing now validates the full version-1 card/review/audio schema before opening a write transaction; duplicate identities and malformed audio are rejected, malformed JSON receives a plain-language message, and import writes are one atomic IndexedDB transaction. Corrupt legacy records are ignored rather than crashing Library.
- Library search preserves its text cursor and focus across incremental DOM updates. `/`, `?`, and the physical slash key focus the search. The skip link focuses the main landmark without entering the hash router; the visually hidden file input exposes focus on its Import label.
- Human language labels (such as `Spanish`) are no longer assigned to HTML `lang`; only BCP 47-shaped values are emitted. This removes populated-state axe `valid-lang` violations.
- “Again · 10 min” now schedules exactly 600,000 ms later. The skip link, brand link, and See library link meet the 44px minimum target.
- Static hosting now ships CSP, `Permissions-Policy`, `X-Frame-Options`, correct `application/manifest+json` manifest MIME, and immutable caching for content-hashed application assets. Vite emits hashed JS/CSS and a precache manifest; the service worker cache and script change with each build so updates remain discoverable.

## Verification

- Clean install: `npm ci` installed 61 packages.
- Dependency checks: `npm audit --omit=dev` and `npm audit` both report 0 vulnerabilities.
- Unit/integration: `npm test` passes 10 tests (scheduler timing, complete/invalid backup schema, and static response policy).
- Type/build: `npm run build` passes (`tsc --noEmit` + Vite), producing `dist/index.html`; current output is 32.61 KB JS (11.80 KB gzip), 19.65 KB CSS (5.25 KB gzip), and 18.97 KB mobile hero.
- Browser: `npm run test:e2e` passes 18/18 across Desktop Chromium and Pixel 5 / 390px. New exact regressions cover recording draft preservation and live-track teardown, invalid import rejection, per-keystroke keyboard search, populated-state axe, skip/file-input focus, and offline service-worker reload.
- Factory URL verifier passed locally (622 ms) and live (721 ms): title/lang, one h1, main, image alt text, labeled buttons, and console errors all clean.
- Live browser smoke at 1366px and 390px: no console/page errors, no horizontal overflow, and service worker controlled. Live offline reload retained the app shell; first-load resource inspection found no cross-origin requests.
- Live response policy: CSP contains `frame-ancestors 'none'`; `Permissions-Policy` limits microphone to self; `X-Frame-Options: DENY`; manifest is `application/manifest+json`; `/assets/app-C5ix2KWv.js` is `public, max-age=31536000, immutable`.
- Live identity representative SHA-256 matches: `index.html` `0fd099a05d5a5e89a456053f8eb0db1f4c926afe63f8c66d18a0a7355d615f65`; JS `14b3299a0121897027b411edebc67240d818bc88b895a4d587dcf629f6b94553`; CSS `2e7a3dc79ef919e2f1b64561c1e0c5e9b852c238459cf52bbc76e70a3745326b`; `sw.js` `84d700e367f722aa46930acab47deb6c0b68e14568740aafbb185cb2254c881d`.

Lighthouse 13.4 with the container’s Playwright Chromium produced FCP 0.9 s, LCP 1.5 s, TBT 0 ms, and CLS 0, but did not calculate a Performance category score in this headless harness. The prior independent Lighthouse run on the unchanged visual/runtime baseline recorded 100/100/100/100; the repaired JS remains far below the 200 KB budget.

## External blockers retained for factory action

The two billing findings are not code or static-deployment configurable and remain blocked by the Sociobot billing service:

- On 2026-08-28 after deployment, `GET https://api.sociobot.in/api/v1/products/context-recall-cards/checkout` still returns `404 {"error":"enabled factory product","status":404}`. The product must be registered/enabled in the factory billing engine before the advertised unlock can be purchased.
- The verifier’s 300-request live test established that the verification API returned 300×200 with no `429`/`Retry-After`. This static client cannot enforce a server-side shared rate limit. Configure rate limiting on `api.sociobot.in` for the verify endpoint, then repeat that burst test.

The client continues to use only the required Sociobot checkout/verify contract and leaves the free local-first experience available offline. No repository-side safe change can enable a paid product or alter API rate limiting.

## Run / deploy

```sh
npm ci
npm audit --omit=dev
npm audit
npm test
npm run build
npm run test:e2e
/opt/fleet/lib/deploy-static.sh context-recall-cards dist
```
