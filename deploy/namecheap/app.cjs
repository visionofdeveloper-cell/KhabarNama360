/**
 * 360Khabarnama — Namecheap cPanel Node.js Selector / Phusion Passenger Entrypoint
 *
 * Upload this file as `app.cjs` in your cPanel Node.js application root
 * (or set Application startup file to `deploy/namecheap/app.cjs`).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Resolve application root whether running from root/app.cjs or deploy/namecheap/app.cjs
const candidateRoots = [
  __dirname,
  path.resolve(__dirname, '../..'),
  process.cwd(),
];

const appRoot =
  candidateRoots.find((dir) => fs.existsSync(path.join(dir, 'firebase-applet-config.json'))) ||
  process.cwd();

process.chdir(appRoot);
process.env.NODE_ENV = 'production';

const bundledServer = path.join(appRoot, 'dist-server', 'server.mjs');
const tsServer = path.join(appRoot, 'server.ts');

async function boot() {
  if (fs.existsSync(bundledServer)) {
    await import(pathToFileURL(bundledServer).href);
    return;
  }
  if (fs.existsSync(tsServer)) {
    await import(pathToFileURL(tsServer).href);
    return;
  }
  throw new Error(
    `[360Khabarnama] Neither dist-server/server.mjs nor server.ts found in ${appRoot}. Run "npm run build:cpanel" first.`
  );
}

boot().catch((err) => {
  console.error('[360Khabarnama Passenger Boot Error]', err);
  process.exit(1);
});
