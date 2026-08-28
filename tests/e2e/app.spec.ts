import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    indexedDB.deleteDatabase('context-recall-cards');
    localStorage.clear();
  });
  await page.reload();
});

test('creates, practices, and persists a personal context', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Give a word somewhere to live.' })).toBeVisible();
  await page.getByRole('link', { name: 'Add your first context' }).click();
  await page.getByLabel('Word or phrase required').fill('último');
  await page.getByLabel('Language optional').fill('Spanish');
  await page.getByLabel('Your sentence required').fill('Perdí el último autobús a casa.');
  await page.getByLabel('Meaning in this moment optional').fill('last');
  await page.getByRole('button', { name: 'Save context' }).click();

  await expect(page.getByText('1 context ready')).toBeVisible();
  await page.getByRole('button', { name: 'Begin recall' }).click();
  await expect(page.getByText('Perdí el _____ autobús a casa.')).toBeVisible();
  await page.getByLabel('Your answer').fill('último');
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('That’s it.')).toBeVisible();
  await page.getByRole('button', { name: /Recalled it/ }).click();
  await expect(page.getByText('Session complete. Your next return is scheduled.')).toBeVisible();

  await page.reload();
  await page.getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'último' })).toBeVisible();
  await expect(page.getByText('1 review')).toBeVisible();
});

test('validates that the target appears in its sentence', async ({ page }) => {
  await page.goto('/#add');
  await page.getByLabel('Word or phrase required').fill('bonjour');
  await page.getByLabel('Your sentence required').fill('Je dis salut.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await expect(page.getByRole('alert')).toContainText('does not appear');
});

test('has no serious accessibility violations on the first screen', async ({ page }) => {
  // axe and the pinned worker Playwright release publish Page types independently.
  const results = await new AxeBuilder({ page: page as never }).analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('loads its practiced field book offline', async ({ page, context }) => {
  await page.goto('/#add');
  await page.getByLabel('Word or phrase required').fill('morgen');
  await page.getByLabel('Your sentence required').fill('Bis morgen früh.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('1 context ready')).toBeVisible();
  await expect(page.getByText('Offline · still ready')).toBeVisible();
});
