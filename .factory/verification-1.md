# Independent product verification — FAIL

- Date: 2026-08-28 UTC
- Candidate: `21a504060cbc6c5a2827b00729b212afb1254a74`
- Branch: `main`
- Live URL: <https://context-recall-cards.sociobot.in>
- Work order: `context-recall-cards-verify-1`
- Result: **FAIL — do not promote this candidate**

The local build is small, fast, visually distinctive, and its basic text-only recall loop works. The live deployment is byte-for-byte the candidate. Acceptance nevertheless fails: production checkout is unavailable, the billing verification endpoint did not rate-limit a 300-request burst, leaving a recording screen does not stop the microphone, and stopping a card recording erases the learner's draft. The expanded accessibility and invalid-import checks also found serious defects outside the builder's happy-path suite.

## Release-blocking defects

### High — production purchase cannot be completed

The shipped `$12` button points to the required Sociobot endpoint, but that endpoint is not enabled:

```text
GET https://api.sociobot.in/api/v1/products/context-recall-cards/checkout
HTTP/2 404
{"error":"enabled factory product","status":404}
```

This is live release evidence, not an inferred deployment risk. The advertised one-time unlock cannot be purchased.

### High — pronunciation recording destroys the draft

Reproduction on both local production preview and live:

1. Open Add context.
2. Enter word `último`, sentence `Perdí el último autobús a casa.`, language, meaning, and source.
3. Start and stop a microphone recording.

After stop, the form is re-rendered with these values:

```json
{"id":"","word":"","language":"","sentence":"","meaning":"","source":""}
```

The recording remains marked ready, but every typed field has been erased. The learner must re-enter the entire card before saving. This breaks the brief's compact sentence-plus-voice capture loop.

### High — microphone remains live after leaving the recording screen

With a fake browser microphone instrumented to expose its track state:

```json
{
  "during": "live",
  "afterNav": {"hash":"#today","track":"live","recordControls":0}
}
```

Starting a recording and selecting Today removes all recording controls while the audio track continues capturing. It stops only when the recorder reaches its 120-second limit or the page closes. This violates reasonable privacy expectations for a recording-focused, privacy-first product.

### High — billing verification endpoint has no observable rate limit

A rapid burst of 300 invalid-token requests was sent in batches of 10 to:

```text
GET https://api.sociobot.in/api/v1/products/context-recall-cards/verify?license=<unique-invalid-token>
```

Observed threshold: **none through 300 requests**. Results were `300 × HTTP 200`; no `429` and therefore no `Retry-After` header. The work order explicitly requires this endpoint to begin returning `429` with `Retry-After`.

## Other defects

### Medium — structurally invalid imports are accepted and corrupt navigation

This version-1 bundle passes `parseImport` despite omitting required card fields:

```json
{"format":"context-recall-cards","version":1,"cards":[{"id":"bad","word":"hola","sentence":"hola"}]}
```

The UI reports `Imported 1 newer context.`. Opening Library then leaves the old Ownership screen under a `#library` URL and raises:

```text
TypeError: Cannot read properties of undefined (reading 'length')
```

The malformed record remains in IndexedDB. Invalid input should be rejected before persistence.

### Medium — library keyboard search loses focus after one character

The `/` shortcut targets the search input, but its `input` handler replaces the full app DOM on every change. Typing `missing-query` by keyboard leaves only `m` in the new input and moves focus away. Programmatic single-operation `fill()` works, which explains why this can be missed by automation that does not type key-by-key.

### Medium — user-facing language names create serious axe violations

The form asks for a language and suggests `Spanish`, then writes that value directly to the HTML `lang` attribute. Axe reports serious `valid-lang` failures on the revealed listen, cloze, speak, and Library states. `lang="Spanish"` is invalid; the attribute needs a BCP 47 value such as `es`, or the free-text field must not be used as `lang`.

### Medium — skip link does not retain focus on the main landmark

Across three local and three live attempts, activating `Skip to practice` set `#main` but focus ended on `<body>`, not `<main id="main">`. The hash router treats `main` as an unknown view and re-renders the DOM, replacing the focused target.

### Medium — import control has no visible keyboard focus

The file input receives focus and computes a 3px outline, but the entire input has `opacity: 0`; the wrapping label has no `:focus-within` treatment. Keyboard users therefore get no visible indication when focus reaches Import backup.

### Medium — “Again · 10 min” actually schedules about 58 minutes

Fresh live observation:

```json
{"label":"Again\n10 min","scheduledMinutes":58,"scheduledMs":3456084}
```

The scheduler uses `0.04 × 86,400,000 ms` (57.6 minutes), inconsistent with the action's promised interval.

### Low — malformed JSON exposes a raw parser message

Importing `{not json` shows `Expected property name or '}' in JSON at position 1 (line 1 column 2)` rather than the product's plain-language recovery message.

### Low — several mobile targets are below 44px

At a 390px viewport the visible targets below the stated minimum were:

| Target | Measured size |
| --- | ---: |
| Skip to practice | 174 × 43 px |
| Context Recall home | 171.1 × 25 px |
| See library | 86.4 × 19 px |

Primary actions and bottom navigation met the target size; these links did not.

### Low — production response policy/caching gaps

- HTTPS redirect, HSTS, `nosniff`, and `strict-origin-when-cross-origin` are present.
- No `Content-Security-Policy`, `Permissions-Policy`, or frame-embedding defense (`frame-ancestors`/`X-Frame-Options`) is sent.
- `/manifest.webmanifest` is served as `application/octet-stream`, not a manifest JSON MIME type. Chromium still parsed it without errors.
- Versioned JS/CSS and image assets are only `public, must-revalidate, max-age=30`; they do not receive long-lived immutable caching as required by the performance contract. Conditional requests do return `304`, and Brotli compression works.

## What passed

### Clean checkout and repository gates

The tree was clean at the candidate before verification. Node was `v22.23.2`; npm was `10.9.8`.

| Gate | Result |
| --- | --- |
| `npm ci` | PASS, 61 packages installed from lockfile |
| `npm audit --omit=dev` | PASS, 0 vulnerabilities |
| `npm audit` | PASS, 0 vulnerabilities |
| `npm test` | PASS, 6/6 |
| TypeScript | PASS via `tsc --noEmit` in production build |
| Lint | No lint script/configuration is available in the repository |
| `npm run build` | PASS, exact production build emitted `dist/` |
| `npm run test:e2e` | PASS, 10/10 (desktop Chromium and configured Pixel 5) |

### Independent functional coverage

An independent Playwright flow ran against both the production preview and live site. It did not reuse the repository assertions. Forty-plus checks per target covered:

- required-field and target-not-in-sentence errors, focus recovery, and corrected save;
- exact 80-character word and 500-character sentence boundaries; browser input capped attempted 81st/501st characters and the boundary card saved;
- microphone success and denial paths;
- persisted audio Blob and `listen → cloze → speak` progression;
- accent-sensitive failure, case-insensitive accented recovery, reveal, and all grading affordances;
- refresh and tab-close persistence;
- Library filtering and empty results;
- export consent decline/accept, JSON download, invalid import, and delete cancel/confirm;
- 25-card and 5-recording free limits;
- invalid license recovery and removal of the invalid local token;
- offline route reload and persisted 25-card IndexedDB state;
- 390px layout, reduced motion, and 200% root text sizing.

Passing observations included:

- denied microphone access produced an actionable message and left text capture usable;
- a recorded audio Blob was stored in IndexedDB and drove a listen prompt;
- speak-back attempts disappeared after leaving the card;
- deletion required a specific confirmation and cancellation preserved the card;
- 25 contexts blocked creation of a 26th card; five recordings disabled a sixth recording;
- 390px and 200% text checks had no horizontal overflow;
- no unexpected console/page errors occurred in the valid live workflow.

### Accessibility

- Correct title, `lang="en"`, one `<h1>`, and a `<main>` on the app shell.
- All images have alt text; controls have accessible names.
- Visible 3px focus styling exists for normal buttons, links, fields, and summaries.
- `prefers-reduced-motion: reduce` changed scrolling to `auto` and animation duration to `0.00001s`.
- Axe serious/critical count was zero on empty desktop, empty Add, Ownership, empty 390px mobile, Privacy, and Terms.
- Content-bearing practice and Library screens fail only the `valid-lang` issue documented above.
- Privacy and Terms each have a title, language, one h1, main landmark, and no serious/critical axe findings.

### Privacy and outbound traffic

- A fresh first load made no cross-origin request.
- Source inspection and browser observation found no analytics, ads, CDN fonts/scripts, sync, or unrelated third-party calls.
- Learning data and audio were kept in IndexedDB. The license and cached verdict used the documented localStorage keys.
- Export required explicit confirmation; cancellation produced no download.
- The only cross-origin app request observed was the user-triggered Sociobot license verification call.
- The production API returned `Access-Control-Allow-Origin: https://context-recall-cards.sociobot.in`, `Vary: origin`, and `Cache-Control: no-store`; an untrusted origin received no allow-origin header.
- There is no sign-in flow, so Entra authority verification is not applicable.

The hidden live microphone after navigation is the exception to the otherwise local/private behavior and is release-blocking.

### Live deployment identity

Direct downloads from the live origin matched the candidate build byte-for-byte for all tested release artifacts: HTML, JS, CSS, service worker, manifest, offline page, privacy, terms, both hero images, and all three PNG app icons. Representative hashes:

```text
index.html              710e9b5d6babb94b7613b63f36204db73ee94eb009db6419b9d448e1a1281342
assets/app-1.0.0.js     28ff5201b2023aa25cb880026c367d28cda1319d78a8ca89816ea4955d197c7a
assets/app-1.0.0.css    baa6b83116272b9d44fcb84fbb4084fb48153067a547f8cba0a38dfb79585eb5
sw.js                   b5e68015968594cce4ec1654ab8c0a0e3bd030c6f3fdf94bfb0c07089185d640
manifest.webmanifest    886d7f38f46765d33e6b27fb52addad06d0ba579580c4b8bc196024a02b29910
```

The factory `verify-url.sh` passed local and live. Live result: HTTP 200, 782ms network-idle load, correct title/language, one h1, main present, no missing alt text, no unlabeled buttons, and no first-load console errors. Desktop and 390px screenshots were visually reviewed; the product-specific blue-hour field-note system is present and no horizontal clipping was found.

### PWA/offline behavior

- Chromium parsed the manifest with no errors and found the expected standalone display, versioned start URL, 192/512 icons, and maskable 512 icon. The PNG dimensions match their declarations.
- A live service worker controlled the page and cached the app shell.
- After network was disabled, app routes, stored data, JS, `/privacy/`, and `/terms/` reloaded successfully.
- A controlled update harness served the exact build with only an in-memory service-worker cache-version change. The app displayed `A fresh version is ready. Update now`; activating it reloaded under the new worker and left only the new shell/runtime caches.

### Performance and bundles

Lighthouse 12.8.2 mobile simulation:

| Target | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Local production preview | 100 | 100 | 100 | 100 | 0.9s | 1.5s | 0ms | 0 |
| Live | 100 | 100 | 100 | 100 | 0.9s | 1.1s | 10ms | 0 |

Lab INP is not available without interactions; live Max Potential FID was 160ms. Bundle measurements:

| Asset | Uncompressed | Live transferred |
| --- | ---: | ---: |
| JavaScript | 29,856 B | 11,168 B Brotli |
| CSS | 19,429 B | 5,424 B Brotli |
| Mobile hero | 18,968 B | 18,968 B |
| Desktop hero | 63,640 B | 63,640 B |
| Fonts | 0 B | 0 B |

All size and lab performance budgets pass. The full `dist/` excluding the source map is 182,041 bytes.

## Required remediation before re-verification

1. Enable/register the production paid product and prove checkout reaches hosted payment.
2. Add effective verification-endpoint rate limiting that returns `429` plus `Retry-After`, then record its threshold.
3. Preserve draft form values through recording state changes and stop all media tracks whenever the user leaves a recording view.
4. Validate every imported field/schema before any IndexedDB write; reject malformed bundles atomically.
5. Keep search focus/value stable across keystrokes, repair skip-link focus, and expose visible focus on the hidden file input's label.
6. Separate human-readable language names from BCP 47 tags and clear all serious axe findings on populated states.
7. Make the “Again” schedule match its displayed interval.
8. Correct manifest MIME/caching and add an explicit CSP/frame policy.

Re-run the full clean-install, live identity, purchase, rate-limit, populated-state axe, microphone-navigation, invalid-import, keyboard, PWA update/offline, artifact hash comparison, and Lighthouse mobile checks after remediation.
