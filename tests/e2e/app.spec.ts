import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('creates, practices, persists, and reloads offline', async ({ page, context }) => {
  await expect(page.getByRole('heading', { name: 'Practice words from your own sentences.' })).toBeVisible();
  await page.getByRole('link', { name: 'Add a real context' }).click();
  await page.getByLabel('Word or phrase required').fill('último');
  await page.getByLabel('Language optional').fill('Spanish');
  await page.getByLabel('Your sentence required').fill('Perdí el último autobús a casa.');
  await page.getByLabel('Meaning in this moment optional').fill('last');
  await page.getByRole('button', { name: 'Save context' }).click();

  await expect(page.getByRole('heading', { name: '1 context ready' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  const cachedShellBytes = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const shell = (await caches.keys()).find((name) => name.includes('-shell'));
    const cache = shell ? await caches.open(shell) : undefined;
    const request = (await cache?.keys())?.find((item) => item.url.endsWith('.js'));
    const response = request ? await cache?.match(request) : undefined;
    return response ? (await response.clone().arrayBuffer()).byteLength : 0;
  });
  expect(cachedShellBytes).toBeGreaterThan(20_000);
  await context.setOffline(true);
  await page.reload();
  const offlineState = await page.evaluate(async () => ({
    controlled: Boolean(navigator.serviceWorker?.controller),
    shell: (await caches.keys()).some((name) => name.includes('-shell')) ? 200 : 0,
    fetched: await fetch([...document.scripts].find((script) => script.src.includes('/assets/'))?.src ?? '/').then((response) => response.status).catch(() => 0),
  }));
  expect(offlineState).toEqual({ controlled: true, shell: 200, fetched: 200 });
  await expect(page.getByRole('heading', { name: '1 context ready' })).toBeVisible();
  await expect(page.getByText('Offline · still ready')).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await page.getByRole('button', { name: 'Begin recall' }).click();
  await expect(page.getByText('Perdí el _____ autobús a casa.')).toBeVisible();
  await page.getByLabel('Your answer').fill('último');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('That’s it.')).toBeVisible();
  await page.getByRole('button', { name: /Recalled it/ }).click();
  await expect(page.getByText('Session complete. Your next return is scheduled.')).toBeVisible();

  await page.reload();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'último' })).toBeVisible();
  await expect(page.getByText('1 review')).toBeVisible();
});

test('validates that the target appears in its sentence', async ({ page }) => {
  await page.goto('/#add');
  await page.getByLabel('Word or phrase required').fill('bonjour');
  await page.getByLabel('Your sentence required').fill('Je dis salut.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await expect(page.locator('[data-form-error]')).toContainText('does not appear');
});

test('has no serious accessibility violations on the first screen', async ({ page }) => {
  // axe and the pinned worker Playwright release publish Page types independently.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('has no serious accessibility violations in demo, privacy, terms, or not-found states', async ({ page }) => {
  for (const route of ['/demo', '/privacy/', '/terms/', '/does-not-exist']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page: page as never }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? '')), route).toEqual([]);
  }
});

test('uses route titles, one page heading, metadata, and a styled unknown-route state', async ({ page }) => {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://context-recall-cards.sociobot.in/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /social-card\.jpg$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  await expect(page.locator('h1')).toHaveCount(1);
  await page.goto('/demo');
  await expect(page).toHaveTitle('Demo — Context Recall Cards');
  await expect(page.locator('h1')).toHaveCount(1);
  await page.goto('/does-not-exist');
  await expect(page).toHaveTitle('Page not found — Context Recall Cards');
  await expect(page.getByRole('heading', { name: 'This page is not in the field book.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to today' })).toBeVisible();
});

test('@claim:json-backup exports a private backup and imports a newer context', async ({ page }) => {
  await page.goto('/demo#ownership');
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('demo:context-recall-cards', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      const get = store.get('demo-ultimo');
      get.onsuccess = () => store.put({ ...get.result, audio: new Blob(['demo voice'], { type: 'audio/webm' }), audioMime: 'audio/webm' });
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  await page.reload();

  page.once('dialog', (dialog) => dialog.accept());
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile(path!, 'utf8')) as { format: string; cards: Array<Record<string, unknown>> };
  expect(exported.format).toBe('context-recall-cards');
  expect(exported.cards).toHaveLength(3);
  expect(exported.cards.some((card) => String(card.audioDataUrl ?? '').startsWith('data:audio/webm;base64,'))).toBe(true);

  const incoming = structuredClone(exported);
  incoming.cards[0].id = 'imported-context';
  incoming.cards[0].word = 'ailleurs';
  incoming.cards[0].sentence = 'Je voudrais vivre ailleurs.';
  incoming.cards[0].updatedAt = Date.now() + 1_000;
  await page.locator('[data-import]').setInputFiles({ name: 'recall-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await expect(page.getByText('Imported 1 newer context.')).toBeVisible();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: '4 personal contexts' })).toBeVisible();
  expect(await page.evaluate(async () => new Promise<boolean>((resolve, reject) => {
    const request = indexedDB.open('demo:context-recall-cards', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const get = request.result.transaction('cards').objectStore('cards').get('imported-context');
      get.onsuccess = () => resolve(get.result.audio instanceof Blob);
    };
  }))).toBe(true);
});

test('@claim:offline-reload keeps the sample field book available offline after the first visit', async ({ page, context }) => {
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: '3 contexts ready' })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Offline · still ready')).toBeVisible();
  await expect(page.getByRole('heading', { name: '3 contexts ready' })).toBeVisible();
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
});

test('@claim:installable-pwa exposes a standalone manifest and controlling service worker', async ({ page }) => {
  await page.goto('/demo');
  const evidence = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const manifest = await fetch(manifestLink?.href ?? '').then((response) => response.json()) as {
      display: string; start_url: string; icons: Array<{ sizes: string; purpose: string }>;
    };
    return {
      controlled: Boolean(navigator.serviceWorker.controller),
      display: manifest.display,
      startUrl: manifest.start_url,
      sizes: manifest.icons.map((item) => item.sizes),
      maskable: manifest.icons.some((item) => item.purpose === 'maskable'),
    };
  });
  expect(evidence).toEqual({ controlled: true, display: 'standalone', startUrl: '/?v=2#today', sizes: ['192x192', '512x512', '512x512'], maskable: true });
});

test('@claim:demo-isolation keeps sample changes outside the real field book and discards them', async ({ page }) => {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('context-recall-cards', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('cards', { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('cards', 'readwrite');
        tx.objectStore('cards').put({
          id: 'real-card', word: 'real', sentence: 'A real sentence.', meaning: '', language: '', source: '',
          createdAt: 1, updatedAt: 1, dueAt: Date.now(), intervalDays: .25, promptMode: 'cloze', reviews: [],
        });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  });
  await page.goto('/demo#add');
  await page.getByLabel('Word or phrase required').fill('mismo');
  await page.getByLabel('Your sentence required').fill('Es el mismo lugar.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await expect(page.getByRole('heading', { name: '4 contexts ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByRole('heading', { name: '3 contexts ready' })).toBeVisible();
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'real' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'último' })).toHaveCount(0);
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name))).not.toContain('demo:context-recall-cards');
});

test('@claim:local-private stores a recorded context locally without cross-origin requests', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.addInitScript(() => {
    const track = { stop() {} };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    class FakeRecorder {
      state = 'inactive'; ondataavailable: ((event: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      constructor(_stream: unknown) {}
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['sample voice'], { type: 'audio/webm' }) }); this.onstop?.(); }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeRecorder });
  });
  await page.goto('/demo#add');
  await page.getByLabel('Word or phrase required').fill('mañana');
  await page.getByLabel('Your sentence required').fill('Nos vemos mañana.');
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByRole('button', { name: 'Save context' }).click();
  const stored = await page.evaluate(async () => new Promise<{ count: number; audioIsBlob: boolean }>((resolve, reject) => {
    const request = indexedDB.open('demo:context-recall-cards', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const all = request.result.transaction('cards').objectStore('cards').getAll();
      all.onsuccess = () => resolve({ count: all.result.length, audioIsBlob: all.result.some((card) => card.word === 'mañana' && card.audio instanceof Blob) });
    };
  }));
  expect(stored).toEqual({ count: 4, audioIsBlob: true });
  expect(requests.every((url) => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
  expect(await page.locator('input[type="email"], input[type="password"]').count()).toBe(0);
});

test('@claim:recall-sequence schedules a sample after cloze retrieval', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Begin recall' }).click();
  await expect(page.getByText('Perdí el _____ autobús a casa.')).toBeVisible();
  await page.getByLabel('Your answer').fill('último');
  await page.getByRole('button', { name: 'Check' }).click();
  await page.getByRole('button', { name: /Recalled it/ }).click();
  const review = await page.evaluate(async () => new Promise<{ reviews: number; future: boolean }>((resolve, reject) => {
    const request = indexedDB.open('demo:context-recall-cards', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const card = request.result.transaction('cards').objectStore('cards').get('demo-ultimo');
      card.onsuccess = () => resolve({ reviews: card.result.reviews.length, future: card.result.dueAt > Date.now() });
    };
  }));
  expect(review).toEqual({ reviews: 1, future: true });
});

test('@claim:license-unlock captures and verifies a returned purchase license', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/context-recall-cards/verify?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }),
  }));
  await page.goto('/demo?license=license-for-test#ownership');
  await expect(page).toHaveURL('http://127.0.0.1:4173/demo#ownership');
  await expect(page.getByRole('heading', { name: 'Your field book is unlocked.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('demo:sb_license:context-recall-cards'))).toBe('license-for-test');
});

test('@claim:checkout-paused does not advertise or link to unavailable checkout', async ({ page }) => {
  await page.goto('/demo#ownership');
  await expect(page.getByRole('heading', { name: 'Purchases are paused.' })).toBeVisible();
  await expect(page.locator('a[href*="/checkout"]')).toHaveCount(0);
  await expect(page.getByText('Checkout is not available in this release.')).toBeVisible();
});

test('@claim:free-limits enforces 25 contexts and 5 recordings without a license', async ({ page }) => {
  await page.goto('/demo');
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('demo:context-recall-cards', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      store.clear();
      for (let index = 0; index < 24; index += 1) {
        store.put({
          id: `limit-${index}`, word: `word${index}`, sentence: `This sentence has word${index}.`, meaning: '', language: '', source: '',
          createdAt: index + 1, updatedAt: index + 1, dueAt: Date.now(), intervalDays: .25, promptMode: 'cloze', reviews: [],
          ...(index < 5 ? { audio: new Blob(['voice'], { type: 'audio/webm' }), audioMime: 'audio/webm' } : {}),
        });
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.getByRole('link', { name: 'Add context', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeDisabled();
  await expect(page.getByText('The free field book includes 5 recordings.')).toBeVisible();
  await page.getByLabel('Word or phrase required').fill('final');
  await page.getByLabel('Your sentence required').fill('This is the final sentence.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await page.getByRole('link', { name: 'Add context', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your free field book is full.' })).toBeVisible();
  await expect(page.getByText('all 25 contexts')).toBeVisible();
});

test('@claim:recording-control preserves the draft and stops the microphone on navigation', async ({ page }) => {
  await page.addInitScript(() => {
    let track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          (window as typeof window & { mediaRequestCount?: number }).mediaRequestCount = ((window as typeof window & { mediaRequestCount?: number }).mediaRequestCount ?? 0) + 1;
          track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
          (window as typeof window & { recordingTrack: typeof track }).recordingTrack = track;
          return { getTracks: () => [track] };
        },
      },
    });
    class FakeRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: unknown) {}
      start() { this.state = 'recording'; }
      stop() {
        if (this.state !== 'recording') return;
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['voice'], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: FakeRecorder });
    (window as typeof window & { recordingTrack: typeof track }).recordingTrack = track;
  });
  await page.goto('/demo?fake-recorder=1#add');
  await page.getByLabel('Word or phrase required').fill('último');
  await page.getByLabel('Language optional').fill('Spanish');
  await page.getByLabel('Your sentence required').fill('Perdí el último autobús a casa.');
  await page.getByLabel('Meaning in this moment optional').fill('last');
  await page.getByLabel('Where you met it optional').fill('the station');
  expect(await page.evaluate(() => (window as typeof window & { mediaRequestCount?: number }).mediaRequestCount ?? 0)).toBe(0);
  await page.getByRole('button', { name: /Start recording/ }).click();
  expect(await page.evaluate(() => (window as typeof window & { mediaRequestCount?: number }).mediaRequestCount ?? 0)).toBe(1);
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await expect(page.getByLabel('Word or phrase required')).toHaveValue('último');
  await expect(page.getByLabel('Your sentence required')).toHaveValue('Perdí el último autobús a casa.');
  await expect(page.getByLabel('Meaning in this moment optional')).toHaveValue('last');

  await page.getByRole('button', { name: /Record again/ }).click();
  expect(await page.evaluate(() => (window as typeof window & { recordingTrack: { readyState: string } }).recordingTrack.readyState)).toBe('live');
  await page.getByRole('link', { name: /^Today/ }).click();
  await expect(page).toHaveURL(/#today$/);
  expect(await page.evaluate(() => (window as typeof window & { recordingTrack: { readyState: string } }).recordingTrack.readyState)).toBe('ended');
});

test('rejects invalid imports without corrupting the library', async ({ page }) => {
  await page.goto('/#ownership');
  await page.locator('[data-import]').setInputFiles({
    name: 'broken.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'context-recall-cards', version: 1, cards: [{ id: 'bad', word: 'hola', sentence: 'hola' }] })),
  });
  await expect(page.getByText('That backup is not a valid Context Recall Cards export. Nothing was imported.')).toBeVisible();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByText('Your field book is empty.')).toBeVisible();
});

test('keeps keyboard search focus and clears populated-state accessibility failures', async ({ page }) => {
  await page.goto('/#add');
  await page.getByLabel('Word or phrase required').fill('último');
  await page.getByLabel('Language optional').fill('Spanish');
  await page.getByLabel('Your sentence required').fill('Perdí el último autobús.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await page.keyboard.press('/');
  await page.keyboard.type('missing-query');
  await expect(page.locator('#library-search')).toHaveValue('missing-query');
  await expect(page.locator('#library-search')).toBeFocused();
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('keeps keyboard focus visible for skip and import controls', async ({ page }) => {
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await page.goto('/#ownership');
  await page.locator('[data-import]').focus();
  expect(await page.locator('.file-button').evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
});
