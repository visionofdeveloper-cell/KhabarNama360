import type { IncomingMessage, ServerResponse } from 'http';

let appPromise: Promise<any> | null = null;

async function getExpressApp() {
  if (!appPromise) {
    appPromise = import('../server.ts').then((mod) => mod.default || mod);
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getExpressApp();
    return app(req, res);
  } catch (err: any) {
    // Reset cached promise so subsequent invocations can recover cleanly
    appPromise = null;
    console.error('[Vercel Serverless Fatal]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          error: err?.message || 'Serverless function failed to initialize.',
        })
      );
    }
  }
}
