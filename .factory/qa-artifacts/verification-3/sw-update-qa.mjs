import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = join(process.cwd(), 'dist');
const sourceWorker = await readFile(join(root, 'sw.js'), 'utf8');
let workerVersion = 1;
const server = createServer(async (request, response) => {
  try {
    let path = new URL(request.url, 'http://127.0.0.1').pathname;
    if (path === '/' || path === '/demo') path = '/index.html';
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    const body = path === '/sw.js' ? Buffer.from(`${sourceWorker}\n// qa-update:${workerVersion}\n`) : await readFile(file);
    const type = path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.webmanifest') ? 'application/manifest+json' : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});
await new Promise((resolve) => server.listen(4188, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('http://127.0.0.1:4188/', { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker.ready);
if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
  await page.reload({ waitUntil: 'networkidle' });
}
await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
await page.evaluate(() => sessionStorage.setItem('qa-update-marker', 'before'));
workerVersion = 2;
await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
await page.getByRole('status').filter({ hasText: 'A fresh version is ready.' }).waitFor({ timeout: 15_000 });
const beforeClick = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  return { controlled: Boolean(navigator.serviceWorker.controller), waiting: registration?.waiting?.state, toast: document.querySelector('[role="status"]')?.textContent?.trim() };
});
const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Update now' }).click();
await navigation;
const afterClick = await page.evaluate(() => ({ controlled: Boolean(navigator.serviceWorker.controller), marker: sessionStorage.getItem('qa-update-marker') }));
console.log(JSON.stringify({ beforeClick, afterClick }, null, 2));
await context.close();
await browser.close();
await new Promise((resolve) => server.close(resolve));
