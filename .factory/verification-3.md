# Independent product verification — FAIL

- Date: 2026-08-28 UTC
- Candidate: `b553a5bf3abe97bb92e202f545a8d96b7dbaad0c`
- Branch: `main`
- Live URL: <https://context-recall-cards.sociobot.in>
- Work order: `context-recall-cards-verify-3`
- Result: **FAIL — do not release or promote this candidate**

The production page is the candidate build: the live `app-BNmYLZdP.js` SHA-256 is `43ec60fea3f139bde4f52b2956c5198eeb6201c2beae166ba79f01cfb5e6c8f6`, exactly matching the fresh local `dist/` build. The finding therefore applies to both the repository and deployment.

## Release blocker

### High — the PWA update action does not update the open app

I served a temporary local copy of the exact freshly built `dist/`, changed only the service-worker response version, and exercised the update as a user would:

1. The original worker controlled the page.
2. A new worker installed, and the UI showed **“A fresh version is ready. Update now”**.
3. Selecting **Update now** activated the waiting worker (`active: "activated"`).
4. The current page did not reload within 30 seconds; the update toast remained visible.

The direct runtime result was:

```json
{
  "beforeClick": {"controlled": true, "waiting": "installed"},
  "afterClick": {
    "navigation": "TimeoutError after 30s",
    "controlled": true,
    "active": "activated",
    "toast": "A fresh version is ready.Update now"
  }
}
```

The client registers `controllerchange` only when a `hadController` value captured during initial startup is true. In the exercised first-control/update sequence that value is false, so activation occurs but no reload happens. This violates the PWA requirement for a working update toast/`skipWaiting` + `clientsClaim` flow and leaves an open installed app on its prior UI until the learner manually reloads.

## Required remediation

Make the post-update path reliably reload or otherwise render the newly activated release in the existing client, then add a browser test that performs a real waiting-worker update and asserts that **Update now** completes the refresh (not just that the source contains the event-handler strings).

## What passed

### First read and demo

A cold live visit plainly answers the required questions:

- It does: “Practice words from your own sentences.”
- It is for: independent language learners who forget words in real sentences.
- First action: **Try it with sample data**; its adjacent text says the demo opens three ready-to-practice contexts.

The one-click `/demo` route loaded three realistic contexts and displayed the persistent **“Demo — sample data, nothing is saved”** banner with Reset demo and Start for real. A fresh live demo flow generated no console/page errors and only same-origin requests.

### Mandatory claims contract

`.factory/claims.json` exists and declares ten exact demo-entry-point Playwright commands. I ran each listed command. A first `free-limits` attempt timed out while Playwright copied failure trace artifacts from an earlier ignored results directory; after moving that directory aside, the exact command passed in 11.4 seconds. A clean aggregate run then passed every declared claim:

```text
npm run test:claims
10 passed (25.7s)
```

This covers offline reload, installability, demo namespace isolation, local recording/network privacy, JSON audio backup round-trip, recording cleanup, recall scheduling, free limits, paused checkout, and an existing valid-license restore.

### Repository and build gates

| Check | Result |
| --- | --- |
| Clean dependency install | `npm ci`: 61 packages; 0 audit vulnerabilities |
| Unit/integration | `npm test`: 12/12 passed |
| Typecheck and production build | `npm run build`: passed; `dist/` emitted |
| All browser tests | `npm run test:e2e`: 36/36 passed (desktop and 390×844 mobile) |
| Full audit | `npm audit --omit=dev` and `npm audit`: 0 vulnerabilities |
| Lint | no lint script/configuration is supplied |

The initial bundle is 36.32 KB raw / 12.94 KB gzip; CSS is 20.54 KB raw / 5.45 KB gzip. Both are within the static PWA budgets. No third-party runtime font or script is loaded.

### Live product checks

- Desktop and 390px mobile cold loads produced no console/page errors. At 390px, `scrollWidth` matched the 390px client width.
- Fresh Axe scans of live desktop and mobile landing pages had zero violations, including zero serious/critical findings. Keyboard Tab starts at the skip link and showed the designed `rgb(255, 176, 141) solid 3px` focus outline. The full local browser suite covers populated/demo/legal/not-found states and keyboard recovery.
- Fresh live demo data survived an offline reload under a controlling service worker: banner present, heading `3 contexts ready`, three cards, and `Offline · still ready`.
- Response policy is sound: HTTPS/HSTS, CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, and microphone restricted to self. Hashed JS is immutable for one year and `sw.js` is no-store. `/demo`, `/privacy`, `/terms`, manifest, offline page, and 404 returned 200/expected 404 as appropriate.
- There is no sign-in flow, so Entra External ID is not applicable.
- The only server-side product interaction is Sociobot license verification. A fresh 45-request burst to its invalid-license verify endpoint yielded 30×200 and 15×429; 429 responses had `Retry-After: 4`. The observed threshold is 30 accepted requests per burst.

## Scope note

No product source code was modified during this verification. The temporary update simulation used the exact generated `dist/` files and varied only the served `sw.js` response in memory to create a valid waiting-worker scenario.
