/**
 * Vercel serverless entry point for the Express API.
 *
 * This replaces the Cloudflare Worker + Container front door. Vercel routes
 * every request to this handler, which boots the Express app and returns the
 * response. Unlike Cloudflare Containers there is no long-running process:
 * Socket.IO, BullMQ workers and in-process cron are intentionally not started
 * here because serverless functions are stateless and short-lived.
 *
 * Set WORKER_ENABLED=false and QUEUE_ENABLED=false in the Vercel project's
 * environment variables so the app does not try to start background jobs.
 * Realtime (chat, live order tracking) and scheduled jobs need an alternative
 * on Vercel — see the Deployment section of README.md.
 */

import { createApp } from '../src/app';
import { ENV } from '../src/config/env.config';
import { logger } from '../src/services/logger.service';

/**
 * Create the Express application once per cold start. The module-level cache
 * means warm invocations reuse the same app instance, which is safe because
 * Express apps are stateless between requests.
 */
let app: ReturnType<typeof createApp> | null = null;

export const getApp = (): ReturnType<typeof createApp> => {
  if (!app) {
    app = createApp();
  }
  return app;
};

/**
 * Vercel Node.js runtime calls the default export for every request. The
 * Express app itself is the handler — Vercel adapts its request/response
 * objects to Node's http.IncomingMessage / http.ServerResponse.
 */
export default (req: any, res: any): void => {
  try {
    const handler = getApp();
    void handler(req, res);
  } catch (err) {
    logger.error({ err: (err as Error)?.message }, '[vercel] handler error');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: false,
        message: 'Something went wrong. Error Code (INTERNAL_ERROR)',
        result: {},
      }),
    );
  }
};

/**
 * Log the platform on cold start so operators can confirm the deployment
 * target from the function logs.
 */
if (ENV.NODE_ENV === 'production') {
  logger.info('[vercel] cold start — running on Vercel serverless');
}
