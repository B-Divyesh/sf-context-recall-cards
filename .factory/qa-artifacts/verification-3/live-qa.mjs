import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://context-recall-cards.sociobot.in';
const result = { desktop: {}, mobile: {}, errors: [] };
const browser = await chromium.launch({ headless: true });

async function attachErrors(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') result.errors.push(`${label} console: ${message.text()}`);
  });
  page.on('pageerror', (error) => result.errors.push(`${label} pageerror: ${error.message}`));
}

async function axe(page) {
  const report = await new AxeBuilder({ page }).analyze();
  return report.violations.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }));
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await attachErrors(page, 'desktop');
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(base, { waitUntil: 'networkidle' });
  result.desktop.firstScreen = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    h1: [...document.querySelectorAll('h1')].map((node) => node.textContent?.trim()),
    mains: document.querySelectorAll('main').length,
    sampleAction: [...document.querySelectorAll('a')].some((node) => node.textContent?.trim() === 'Try it with sample data'),
  }));
  result.desktop.rootAxe = await axe(page);
  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await page.waitForURL(`${base}/demo`);
  await page.getByRole('heading', { name: '3 contexts ready' }).waitFor();
  result.desktop.demo = await page.evaluate(async () => ({
    banner: document.body.innerText.includes('Demo — sample data, nothing is saved'),
    databases: (await indexedDB.databases()).map((item) => item.name),
    localKeys: Object.keys(localStorage),
    headingLevels: [...document.querySelectorAll('main h1,main h2,main h3,main h4')].map((node) => node.tagName + ':' + node.textContent?.trim()),
  }));
  result.desktop.demoAxe = await axe(page);
  await page.screenshot({ path: '.factory/qa-artifacts/verification-3/live-demo-desktop.png', fullPage: true });

  await page.getByRole('link', { name: 'Add context', exact: true }).click();
  const word = page.getByLabel('Word or phrase required');
  const sentence = page.getByLabel('Your sentence required');
  await word.pressSequentially('x'.repeat(81));
  await sentence.pressSequentially('y'.repeat(501));
  result.desktop.boundaries = { wordLength: await word.inputValue().then((value) => value.length), sentenceLength: await sentence.inputValue().then((value) => value.length) };
  await word.fill('bonjour');
  await sentence.fill('Je dis salut.');
  await page.getByRole('button', { name: 'Save context' }).click();
  result.desktop.invalidError = await page.locator('[data-form-error]').innerText();
  await sentence.fill('Je dis bonjour.');
  await page.getByRole('button', { name: 'Save context' }).click();
  await page.getByRole('heading', { name: '4 contexts ready' }).waitFor();
  result.desktop.recovered = true;
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('heading', { name: '3 contexts ready' }).waitFor();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await page.keyboard.press('/');
  await page.keyboard.type('encore');
  result.desktop.keyboardSearch = {
    value: await page.locator('#library-search').inputValue(),
    focused: await page.locator('#library-search').evaluate((node) => node === document.activeElement),
  };
  result.desktop.requestOrigins = [...new Set(requests.map((url) => new URL(url).origin))];

  const focusPage = await context.newPage();
  await attachErrors(focusPage, 'focus');
  await focusPage.goto(base, { waitUntil: 'domcontentloaded' });
  await focusPage.keyboard.press('Tab');
  result.desktop.firstTab = await focusPage.evaluate(() => {
    const node = document.activeElement;
    const style = node instanceof Element ? getComputedStyle(node) : null;
    return { text: node?.textContent?.trim(), href: node?.getAttribute?.('href'), outlineStyle: style?.outlineStyle, outlineWidth: style?.outlineWidth, outlineColor: style?.outlineColor };
  });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await attachErrors(page, 'mobile');
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '3 contexts ready' }).waitFor();
  result.mobile.layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    headingInViewport: document.querySelector('h1')?.getBoundingClientRect().top,
    beginRecallInViewport: (() => { const node = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Begin recall')); if (!node) return false; const rect = node.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; })(),
    headingLevels: [...document.querySelectorAll('main h1,main h2,main h3,main h4')].map((node) => node.tagName + ':' + node.textContent?.trim()),
  }));
  result.mobile.motion = await page.evaluate(() => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    animationDuration: getComputedStyle(document.querySelector('.due-preview')).animationDuration,
    transitionDuration: getComputedStyle(document.querySelector('.nav-link')).transitionDuration,
  }));
  result.mobile.axe = await axe(page);
  result.mobile.smallTargets = await page.evaluate(() => [...document.querySelectorAll('a,button,input,textarea,summary')]
    .filter((node) => node instanceof HTMLElement && node.offsetParent !== null && getComputedStyle(node).visibility !== 'hidden')
    .map((node) => { const rect = node.getBoundingClientRect(); return { label: (node.getAttribute('aria-label') || node.textContent || node.getAttribute('name') || node.tagName).trim().replace(/\s+/g, ' ').slice(0, 80), tag: node.tagName, width: Math.round(rect.width), height: Math.round(rect.height) }; })
    .filter((item) => item.width < 44 || item.height < 44));
  await page.screenshot({ path: '.factory/qa-artifacts/verification-3/live-demo-mobile.png', fullPage: true });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  result.mobile.offline = {
    controlled: await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    heading: await page.locator('h1').innerText(),
    state: await page.getByText('Offline · still ready').innerText(),
    samples: await page.getByText('3 contexts ready').count(),
  };
  await context.setOffline(false);
  await context.close();
}

await browser.close();
console.log(JSON.stringify(result, null, 2));
