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
    const response = await caches.match('/assets/app-1.0.0.js');
    return response ? (await response.clone().arrayBuffer()).byteLength : 0;
  });
  expect(cachedShellBytes).toBeGreaterThan(20_000);
  await context.setOffline(true);
  await page.reload();
  const offlineState = await page.evaluate(async () => ({
    controlled: Boolean(navigator.serviceWorker?.controller),
    shell: (await caches.match('/assets/app-1.0.0.js'))?.status ?? 0,
    fetched: await fetch('/assets/app-1.0.0.js').then((response) => response.status).catch(() => 0),
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
