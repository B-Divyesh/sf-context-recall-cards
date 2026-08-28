import { defineConfig, type Plugin } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function precacheManifest(): Plugin {
  let buildFingerprint = '';
  return {
    name: 'context-recall-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.values(bundle)
        .map((output) => `/${output.fileName}`)
        .filter((fileName) => /\.(?:js|css)$/.test(fileName));
      buildFingerprint = assets.join('|');
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.js',
        source: `self.__CRC_PRECACHE = ${JSON.stringify(assets)};`,
      });
    },
    async writeBundle(outputOptions) {
      if (!outputOptions.dir || !buildFingerprint) return;
      const serviceWorker = join(outputOptions.dir, 'sw.js');
      const source = await readFile(serviceWorker, 'utf8');
      await writeFile(serviceWorker, `${source}\n// build:${buildFingerprint}\n`);
    },
  };
}

export default defineConfig({
  plugins: [precacheManifest()],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        assetFileNames: 'assets/app-[hash].[ext]',
      },
    },
  },
  server: {
    port: 4173,
  },
});
