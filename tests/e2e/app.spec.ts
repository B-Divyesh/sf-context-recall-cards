import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('creates, practices, persists, and reloads offline', async ({ page, context }) => {
  await expect(page.getByRole('heading', { name: 'Give a word somewhere to live.' })).toBeVisible();
  await page.getByRole('link', { name: 'Add your first context' }).click();
  await page.getByLabel('Word or phrase required').fill('último');
  await page.getByLabel('Language optional').fill('Spanish');
  await page.getByLabel('Your sentence required').fill('Perdí el último autobús a casa.');
  await page.getByLabel('Meaning in this moment optional').fill('last');
  await page.getByRole('button', { name: 'Save context' }).click();

  await expect(page.getByText('1 context ready')).toBeVisible();
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
  await expect(page.getByText('1 context ready')).toBeVisible();
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

test('exports a private backup and imports a newer context', async ({ page }) => {
  await page.goto('/#add');
  await page.getByLabel('Word or phrase required').fill('encore');
  await page.getByLabel('Your sentence required').fill('Encore un café, s’il vous plaît.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await page.getByRole('link', { name: 'Ownership', exact: true }).click();

  page.once('dialog', (dialog) => dialog.accept());
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile(path!, 'utf8')) as { format: string; cards: Array<Record<string, unknown>> };
  expect(exported.format).toBe('context-recall-cards');
  expect(exported.cards).toHaveLength(1);

  const incoming = structuredClone(exported);
  incoming.cards[0].id = 'imported-context';
  incoming.cards[0].word = 'ailleurs';
  incoming.cards[0].sentence = 'Je voudrais vivre ailleurs.';
  incoming.cards[0].updatedAt = Date.now() + 1_000;
  await page.locator('[data-import]').setInputFiles({ name: 'recall-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(incoming)) });
  await expect(page.getByText('Imported 1 newer context.')).toBeVisible();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 personal contexts' })).toBeVisible();
});

test('captures and verifies a returned purchase license', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/context-recall-cards/verify?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }),
  }));
  await page.goto('/?license=license-for-test#ownership');
  await expect(page).toHaveURL('http://127.0.0.1:4173/#ownership');
  await expect(page.getByRole('heading', { name: 'Your field book is unlocked.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb_license:context-recall-cards'))).toBe('license-for-test');
});

test('stopping a card recording preserves its draft and route changes stop the microphone', async ({ page }) => {
  await page.addInitScript(() => {
    let track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
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
  await page.goto('/?fake-recorder=1#add');
  await page.getByLabel('Word or phrase required').fill('último');
  await page.getByLabel('Language optional').fill('Spanish');
  await page.getByLabel('Your sentence required').fill('Perdí el último autobús a casa.');
  await page.getByLabel('Meaning in this moment optional').fill('last');
  await page.getByLabel('Where you met it optional').fill('the station');
  await page.getByRole('button', { name: /Start recording/ }).click();
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
