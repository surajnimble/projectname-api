/**
 * api/index.ts  ← is file ko project root ke "api/" folder mein rakho
 *
 * Vercel Serverless Entry Point for Express API.
 *
 * server.ts ki jagah ye file use hoti hai Vercel par.
 * server.ts mein `server.listen()` tha — wo serverless mein kaam nahi karta.
 * Yahan sirf Express app export karte hain; Vercel khud listen karta hai.
 *
 * ⚠️  Vercel par disabled features (persistent process nahi hoti):
 *   - Socket.IO     → alag Railway / Render server par deploy karo
 *   - BullMQ Workers → Vercel Dashboard mein WORKER_ENABLED=false set karo
 *   - Queues        → QUEUE_ENABLED=false set karo
 *   - Cron Jobs     → Vercel Cron se karo (vercel.json mein "crons" add karo)
 */

import { createApp } from '../src/app';

const app = createApp();

export default app;
