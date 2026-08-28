# Independent product verification — FAIL

- Date: 2026-08-28 UTC
- Candidate: `43bb8da7fc941ff179e5a527b884429b0b041f78`
- Branch: `main`
- Live URL: <https://context-recall-cards.sociobot.in>
- Work order: `context-recall-cards-verify-2`
- Result: **FAIL — do not release or promote this candidate**

This is a fresh verification from the clean candidate checkout. The deployed HTML, JS, CSS, service worker, and manifest match the candidate build exactly, so the findings apply to both the repository and the live site.

## Release blockers

### High — mandatory claims contract is missing

Before any product test, I checked `.factory/claims.json`. It does not exist. Therefore there are no declared claim tests to run from the required demo entry point, and `rg '@claim:'` finds no tagged claim test in the repository. This is explicitly release-blocking.

The live/README copy also makes unlisted, visitor-reliance claims, including “Works offline”, “No account”, “Your recordings stay here”, “Nothing is uploaded by the app”, local-only storage, JSON export/import, and license limits. No claims manifest maps any of them to observable sandbox tests.

### High — no one-click isolated sample-data demo

Cold live first-read at `https://context-recall-cards.sociobot.in/` showed:

> Give a word somewhere to live. Write the sentence where you found it. Add your voice if you like. We’ll bring it back as a short listen, cloze, and speak prompt. Add your first context.

From that screen, a learner can infer that it makes vocabulary practice from sentences and optional voice, but it does not say that it is for independent language learners. The headline is metaphorical rather than the user’s job in plain words. The only primary action is **Add your first context**, which starts real-data entry.

There is no “Try it with sample data” control, persistent “Demo — sample data, nothing is saved” banner, Reset demo, Start for real action, or `.factory/demo.md`. A fresh browser visit to `/?demo=1` remained on the normal application and opened the real `context-recall-cards` IndexedDB database. The required demo sandbox and the mandatory first-read sample action are absent.

### High — advertised paid unlock cannot be purchased in production

The live Ownership screen advertises “$12 once” and links to the required Sociobot checkout path. Fresh production request:

```text
GET https://api.sociobot.in/api/v1/products/context-recall-cards/checkout
HTTP/2 404
{"error":"enabled factory product","status":404}
```

The one-time purchase cannot complete. This is an external billing-registration/deployment defect, but it blocks release of the advertised paid tier.

## Other defects

### Medium — required route/metadata skeleton is incomplete

`/does-not-exist` returns `200` and the ordinary application shell rather than a product-styled 404 with a way back. `index.html` has no canonical URL, Open Graph/Twitter metadata, or Apple touch icon. The product also uses hash views rather than a real `/demo` route. These miss the specified site-structure contract.

### Medium — plain-words first screen does not identify the intended user

The cold copy explains a workflow but does not name the brief’s audience (independent language learners who cannot retrieve words in real sentences). Its first heading, “Give a word somewhere to live”, is not the required concrete job headline. This is separate from the missing-demo release blocker.

## What passed

### Clean checkout and repository gates

| Check | Fresh result |
| --- | --- |
| Candidate/clean start | `43bb8da7fc941ff179e5a527b884429b0b041f78`; clean worktree before QA docs |
| `npm ci` | PASS — 61 packages, 0 reported vulnerabilities |
| `npm audit --omit=dev` / `npm audit` | PASS — 0 vulnerabilities |
| `npm test` | PASS — 10/10 Vitest tests |
| Type checking and production build | PASS — `npm run build` (`tsc --noEmit` + Vite), `dist/` emitted |
| Repository browser suite | PASS — `npm run test:e2e`, 18/18 Chromium desktop/Pixel 5 tests |
| Lint | No lint script/configuration is provided |

The browser suite covers valid card creation, the sentence-target validation/recovery path, listen/cloze/speak recall, persistence, offline reload, export/import including invalid import recovery, license return capture, recording cleanup, keyboard search/focus, and axe checks. A fresh independent live boundary check also confirmed browser-enforced 80-character word and 500-character sentence limits.

### Live identity, privacy, security, accessibility, and mobile

- The current local `dist/` is byte-identical to live for the checked release artifacts. SHA-256 values: `index.html` `0fd099a05d5a5e89a456053f8eb0db1f4c926afe63f8c66d18a0a7355d615f65`; JS `14b3299a0121897027b411edebc67240d818bc88b895a4d587dcf629f6b94553`; CSS `2e7a3dc79ef919e2f1b64561c1e0c5e9b852c238459cf52bbc76e70a3745326b`; `sw.js` `84d700e367f722aa46930acab47deb6c0b68e14568740aafbb185cb2254c881d`; manifest `358f2ab0d18be084d831a2e1bac4cae1754fee9baa27d3864286534f296568fa`.
- Fresh cold live load made only same-origin requests and generated no console/page errors. There is no sign-in flow, so Entra tenant verification is not applicable.
- At 390px: `scrollWidth === clientWidth === 390`; live Axe serious/critical findings were zero on the empty screen. The repository’s 18-test suite additionally runs populated-state Axe coverage. The skip link has a visible 3px solid focus outline; reduced motion resolves `scroll-behavior` to `auto`.
- Live headers include CSP with `frame-ancestors 'none'`, `Permissions-Policy: ... microphone=(self)`, `X-Frame-Options: DENY`, `nosniff`, HSTS, and strict-origin referrer policy. The manifest is `application/manifest+json`; hashed JS is immutable for one year; `sw.js` is no-store.
- Built initial JS is 32.61 KB raw / 11.80 KB gzip and CSS 19.65 KB raw / 5.25 KB gzip, well below the 200 KB JS and 50 KB CSS budgets; no webfont bytes are shipped. A Lighthouse CLI run could not complete in this container because the supplied Chromium tab crashed, so no Lighthouse score is claimed.

### PWA and API checks

- Fresh live visit was service-worker controlled. After `context.setOffline(true)`, reload retained the app, displayed “Offline · still ready”, and a cached JS fetch returned HTTP 200.
- The update path was independently exercised against a temporary copy of the exact built `dist/`: after a harmless changed service-worker response, the controlled page showed **“A fresh version is ready”** and an installed waiting worker. The source’s Update now action posts `SKIP_WAITING` and reloads on `controllerchange`.
- Fresh rate-limit burst to the live license verification endpoint: 150 rapid unique invalid-token requests in 1.095 s produced 30 × HTTP 200 and 120 × HTTP 429. 429 responses included `Retry-After: 4`. Thus rate limiting now begins after approximately 30 accepted requests in this burst and satisfies the work-order requirement. This is a verified improvement over the earlier report.

## Required remediation

1. Add `.factory/claims.json` and one observable demo-entry-point test per visitor claim; remove any claim that cannot be demonstrated.
2. Build `/demo` or `?demo=1` with realistic sample contexts, a separate `demo:` storage namespace, persistent reset/start-real controls, and `.factory/demo.md`; add the first-screen one-click action.
3. Rewrite the first screen in plain language to name independent language learners, the retrieval problem, and what the first action does.
4. Register/enable `context-recall-cards` in the production Sociobot billing engine, then prove the checkout reaches hosted payment.
5. Add the required real 404 and complete canonical/social/touch metadata.

