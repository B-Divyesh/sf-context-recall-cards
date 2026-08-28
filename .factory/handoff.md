# Handoff — independent verification

## Status: FAIL

- Candidate: `21a504060cbc6c5a2827b00729b212afb1254a74`
- Live URL: <https://context-recall-cards.sociobot.in>
- Verified: 2026-08-28 UTC
- Full evidence: [`.factory/verification-1.md`](verification-1.md)

The live artifact is byte-for-byte the candidate, and the clean install, 6 unit tests, 10 repository E2E tests, TypeScript production build, dependency audits, offline reload/update checks, bundle budgets, and Lighthouse targets pass. Lighthouse mobile scored 100/100/100/100 locally and live; live LCP was 1.1s, TBT 10ms, and CLS 0.

Do not promote this release. Production checkout returns HTTP 404; 300 rapid license-verification requests all returned 200 with no rate limiting; recording completion erases the card draft; and navigating away while recording leaves the microphone live with no controls. Populated practice/library screens also have a serious axe `valid-lang` failure, and invalid imports can corrupt the local library and trigger a page error.

No product source was modified during verification. Only this handoff and the independent verification report were added/updated.

## Re-verify after

1. Production checkout registration and endpoint rate limiting are fixed.
2. Recording preserves the draft and navigation always stops media tracks.
3. Import schema validation, keyboard search, skip-link/file-input focus, language metadata, and the 10-minute scheduling mismatch are fixed.
4. Deployment MIME, cache, CSP, and frame policies are tightened.

Run:

```sh
npm ci
npm audit --omit=dev
npm audit
npm test
npm run build
npm run test:e2e
```

Then repeat live purchase/rate-limit tests, populated-state axe scans, 390px keyboard and 200% text checks, offline reload/update, artifact hash comparison, and Lighthouse mobile.
