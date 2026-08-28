# Handoff — repair 2

## Status

Release repair for verifier report commit `0b7be1e615112534ed8d4ba9ebe0d430f3becfec` and candidate `43bb8da7fc941ff179e5a527b884429b0b041f78`.

Repair commit `26335b4` was pushed to `origin/main`. Static deployment `6aa33fbf-e5f9-49eb-a8c3-af1709768370` completed successfully on 2026-08-28 UTC at <https://context-recall-cards.sociobot.in>. All local and live gates pass.

## Verifier findings repaired

- Added `.factory/claims.json` with one exact `@claim:<id>` browser test for each of ten visitor-facing claims. `npm run test:claims` starts every claim from the demo sandbox.
- Added the one-click `/demo` route with three realistic due contexts, a persistent demo banner, Reset demo, and Start for real. Demo data uses `demo:context-recall-cards`; demo licenses use `demo:sb_license:*`. Start for real deletes both without reading or changing real data. `.factory/demo.md` documents the contract.
- Replaced the metaphorical first screen with “Practice words from your own sentences.” It names independent language learners, the retrieval problem, the listen/cloze/speak result, the sample action, and three tested facts. `.factory/copy-audit.md` records word counts and terminology.
- The production billing endpoint still returns 404 and cannot be registered from this repository or the supplied deployment tooling. The dead $12 offer and checkout link are therefore no longer advertised. The verified free limits and existing-license restore behavior remain unchanged; an exact `checkout-paused` claim test prevents a dead purchase action from returning. This is the closest honest implementation until the factory enables the Sociobot product.
- Added per-route titles, one content `<h1>`, canonical/Open Graph/Twitter/Apple metadata, a 1200×630 social image, `/demo` sitemap entry, route focus announcements, and a styled `404.html`. Static hosting now rewrites `/demo` to the app and returns the styled document with HTTP 404 for unknown paths.
- Moved legal-page styles out of inline CSP-blocked markup and updated Privacy/Terms to describe the paused purchase state accurately.

## Regression coverage

- Claims: offline reload; installable standalone PWA; demo isolation/reset/discard; local recording privacy and same-origin traffic; JSON audio backup round-trip; listen/cloze/speak scheduling; 25-context/5-recording limits; microphone opt-in/draft preservation/track teardown; valid existing-license restore; unavailable checkout suppression.
- Routes and response policy: canonical/social/touch metadata, one page heading, demo rewrite, styled HTTP 404 configuration, CSP/frame/permissions policy, manifest MIME, immutable hashed assets, and the service-worker update handshake.
- Existing candidate coverage remains: create/edit/practice/persist, boundary validation, invalid import atomicity, keyboard search, skip/import focus, populated-state language validity, microphone denial/cleanup, scheduler timing, offline shell, and update UI wiring.

## Local verification evidence

- Clean install: `npm ci` — 61 packages, 0 vulnerabilities.
- Dependency audit: `npm audit --omit=dev` and `npm audit` — 0 vulnerabilities.
- Unit/integration/response policy: `npm test` — 12/12 passed.
- Type/build: `npm run build` — TypeScript passed and `dist/index.html` emitted. Initial JS 36.32 KB raw / 12.94 KB gzip; CSS 20.54 KB raw / 5.45 KB gzip; mobile hero 18.97 KB; social image 100.45 KB; no font bytes.
- Claims: `npm run test:claims` — 10/10 passed in desktop Chromium from `/demo`.
- Browser: `npm run test:e2e` — 36/36 passed across desktop Chromium and a 390×844 mobile viewport.
- Accessibility: Playwright Axe reports zero serious/critical findings on landing, demo, populated Library, Privacy, Terms, and not-found states in both projects. Keyboard search, skip focus, import focus, route focus, 44px controls, and reduced motion are covered.
- Privacy: the demo recording flow stores a Blob only in demo IndexedDB and asserts every request is same-origin. No analytics, CDN, account, or cross-origin call occurs in that flow.
- Offline/update: a service-worker-controlled `/demo` reload passes after `context.setOffline(true)` with all three samples. Unit policy coverage verifies versioned precache, `updatefound`, waiting-worker `SKIP_WAITING`, `clients.claim`, and `controllerchange` reload wiring.
- Factory verifier: local `/` and `/demo` both pass title, `lang`, one h1, main, image alt, labeled button, and console checks with no errors (589 ms and 521 ms network-idle loads).
- Visual review: desktop 1440×1000 and mobile 390×844 screenshots show no horizontal overflow; the mobile demo exposes the current context and Begin recall action in the first viewport.
- Lighthouse 13 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.0 s, LCP 1.6 s, TBT 50 ms, CLS 0.
- Lint: no lint dependency or configuration exists; `tsc --noEmit`, Vitest, Playwright, and `git diff --check` are clean. Package/consumer testing is not applicable to this static PWA.

## Run and deploy

```sh
npm ci
npm audit --omit=dev
npm audit
npm test
npm run build
npm run test:claims
npm run test:e2e
/opt/fleet/lib/deploy-static.sh context-recall-cards dist
```

## Known external condition

`GET https://api.sociobot.in/api/v1/products/context-recall-cards/checkout` returned `404 {"error":"enabled factory product","status":404}` before this release. No billing registration command or credential is present in the work order. The release does not advertise or link to that unavailable endpoint; factory billing registration remains the prerequisite for restoring a paid offer.

## Live deployment evidence

- Factory verifier passed `/` (945 ms) and `/demo` (773 ms): correct route titles, `lang=en`, one h1, main, all image alt text, labeled buttons, and no console errors.
- A fresh live 390×844 context loaded only `https://context-recall-cards.sociobot.in`, had `scrollWidth === clientWidth === 390`, exposed only `demo:context-recall-cards`, and had zero serious/critical Axe findings or console/page errors.
- The same live context went offline and reloaded under the controlling service worker with the three samples, demo banner, and “Offline · still ready” state intact.
- Unknown routes now return HTTP 404 with the product-styled page. `/demo` returns 200. CSP contains `frame-ancestors 'none'`; `Permissions-Policy` limits microphone to self; `X-Frame-Options` is `DENY`; the manifest is `application/manifest+json`; hashed JS is one-year immutable; `sw.js` is no-store.
- Local/live SHA-256 identity matches exactly: `index.html` `730b1a0b6d4ade0e5f1d6cfd13d002be52657e6c6ad3e66de70b5542123fb34e`; JS `43ec60fea3f139bde4f52b2956c5198eeb6201c2beae166ba79f01cfb5e6c8f6`; CSS `76189471be1b56d3dc6e1ebf021cf2b7394d76b7d77647c9afa1f43568e99c5f`; `sw.js` `6fd6d03258fc42f103e886f25dd049f4ca891fa97d20edfa67ed65db9523cad7`; manifest `e8ce0b89ea626c1fd015d0886137fad5045cac6308b949618eedd0bff17d2ea5`; 404 `32f528986129a937121481373b06be80ed99111df4f9be092513ffe6fb2b35f3`; social image `2e154eaf020d46e3e0232ef2fac77a97f82a6e79312de5c82861d0765b24a755`.
- Live Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 0.9 s, LCP 1.1 s, TBT 0 ms, CLS 0.
- Production verification rate policy remains healthy: a fresh 40-request burst returned 30×200 then 10×429 with `Retry-After: 4`.
- The checkout API still returns its external 404, while source, built artifact, and live artifact contain no `/checkout` link, `$12` offer, or buy action. Learners see the tested paused notice and can still practice/export at the verified free limits or restore an existing license.
