/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Namecheap cPanel 5-Minute Cron Dispatcher
 *
 * cPanel Cron Command (Every 5 minutes: 0,5,10... * * * *):
 *   cd /home/USER/app && npx tsx server/jobs/cron-dispatcher.ts >> logs/cron.log 2>&1
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { JobScheduler } from '../../services/automation/JobScheduler.ts';

dotenv.config();

export async function runDueCronJobs() {
  const start = Date.now();
  const res = await JobScheduler.runDueJobs('cpanel_cron');
  return {
    success: true,
    executedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    skipped: res.skipped || null,
    jobsProcessed: res.runs.length,
    runs: res.runs.map(r => ({
      providerId: r.providerId,
      status: r.status,
      durationMs: r.durationMs,
      summary: r.changeSummaryEn,
    })),
  };
}

const metaUrl = typeof import.meta !== 'undefined' ? (import.meta as any).url : undefined;
const isMain = Boolean(
  metaUrl &&
  process.argv[1] &&
  fileURLToPath(metaUrl) === process.argv[1]
);
if (isMain) {
  runDueCronJobs()
    .then(summary => {
      console.log('[Cron Dispatcher]', JSON.stringify(summary));
      process.exit(0);
    })
    .catch(err => {
      console.error('[Cron Dispatcher] Fatal error:', err);
      process.exit(1);
    });
}
