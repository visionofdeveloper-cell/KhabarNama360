import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist-server');

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[cPanel Build] Bundling Express + SSR server for Node.js production...');
  await build({
    entryPoints: [path.join(rootDir, 'server.ts')],
    outfile: path.join(outDir, 'server.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    packages: 'external',
    sourcemap: false,
    logLevel: 'info',
  });

  console.log('[cPanel Build] Bundling Namecheap 5-minute cron dispatcher...');
  await build({
    entryPoints: [path.join(rootDir, 'server/jobs/cron-dispatcher.ts')],
    outfile: path.join(outDir, 'cron-dispatcher.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    packages: 'external',
    sourcemap: false,
    logLevel: 'info',
  });

  const requiredFiles = [
    path.join(rootDir, 'dist/index.html'),
    path.join(outDir, 'server.mjs'),
    path.join(outDir, 'cron-dispatcher.mjs'),
    path.join(rootDir, 'firebase-applet-config.json'),
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing required production artifact: ${file}`);
    }
  }

  console.log('[cPanel Build] Production artifacts ready in dist/ and dist-server/.');
}

main().catch((err) => {
  console.error('[cPanel Build] Failed:', err);
  process.exit(1);
});
