import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('static host response policy', () => {
  it('ships CSP, frame protection, manifest MIME, and immutable asset caching', async () => {
    const config = JSON.parse(await readFile('public/staticwebapp.config.json', 'utf8')) as {
      globalHeaders: Record<string, string>;
      mimeTypes: Record<string, string>;
      routes: Array<{ route: string; rewrite?: string; headers?: Record<string, string> }>;
      responseOverrides: Record<string, { rewrite: string; statusCode: number }>;
    };
    expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders['Permissions-Policy']).toContain('microphone=(self)');
    expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
    expect(config.mimeTypes['.webmanifest']).toBe('application/manifest+json');
    expect(config.routes.find((route) => route.route === '/assets/*')?.headers?.['Cache-Control']).toContain('immutable');
    expect(config.routes.find((route) => route.route === '/demo')?.rewrite).toBe('/index.html');
    expect(config.responseOverrides['404']).toEqual({ rewrite: '/404.html', statusCode: 404 });
  });

  it('ships canonical, social, touch, demo, and styled 404 metadata', async () => {
    const index = await readFile('index.html', 'utf8');
    const notFound = await readFile('public/404.html', 'utf8');
    expect(index).toContain('rel="canonical"');
    expect(index).toContain('property="og:image"');
    expect(index).toContain('name="twitter:card"');
    expect(index).toContain('rel="apple-touch-icon"');
    expect(notFound).toContain('<h1>This page is not in the field book.</h1>');
    expect(notFound).toContain('rel="stylesheet" href="/404.css"');
  });

  it('keeps the versioned service-worker update handshake', async () => {
    const worker = await readFile('public/sw.js', 'utf8');
    const client = await readFile('src/main.ts', 'utf8');
    expect(worker).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(worker).toContain('self.clients.claim()');
    expect(worker).toContain('self.__CRC_PRECACHE');
    expect(client).toContain("registration.addEventListener('updatefound'");
    expect(client).toContain("registration.waiting?.postMessage({ type: 'SKIP_WAITING' })");
    expect(client).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
  });
});
