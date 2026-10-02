import { Router } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { SUCCESS } from '../../messages/success';
import { APP } from '../../config/app.config';
import { isDatabaseHealthy, databaseLatencyMs } from '../../services/prisma.service';
import { isRedisHealthy, isRedisAvailable } from '../../services/redis.service';
import { getActiveWorkerCount } from '../../jobs/workers';
import { QUEUE_ALL, QueueName } from '../../config/socket.config';
import { getJobStatus } from '../../jobs/queues';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

const startedAt = Date.now();

const baseResult = () => ({
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
});

/**
 * GET /api/v1/health — Render uptime probe.
 * No auth, no DB, no Redis: always answers.
 */
router.get('/', (_req, res) =>
  ApiResponse.success(res, {
    message: SUCCESS.SYSTEM.HEALTH_OK,
    result: {
      status: 'UP',
      service: APP.SERVER_NAME,
      version: APP.VERSION,
      environment: process.env.NODE_ENV,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
  }),
);

router.get(
  '/db',
  asyncHandler(async (_req, res) => {
    const [healthy, latency] = await Promise.all([isDatabaseHealthy(), databaseLatencyMs()]);
    return ApiResponse.success(res, {
      message: healthy ? SUCCESS.SYSTEM.HEALTH_OK : 'Database unreachable.',
      result: {
        ...baseResult(),
        database: healthy ? 'UP' : 'DOWN',
        latencyMs: latency < 0 ? 0 : latency,
      },
    });
  }),
);

router.get(
  '/redis',
  asyncHandler(async (_req, res) => {
    const configured = isRedisAvailable;
    const healthy = configured ? await isRedisHealthy() : false;
    return ApiResponse.success(res, {
      message: configured && healthy ? SUCCESS.SYSTEM.HEALTH_OK : 'Redis not available.',
      result: {
        ...baseResult(),
        redis: !configured ? 'NOT_CONFIGURED' : healthy ? 'UP' : 'DOWN',
      },
    });
  }),
);

router.get(
  '/queue',
  asyncHandler(async (_req, res) => {
    const { getQueueConnection } = await import('../../jobs/queues');
    const connection = getQueueConnection();
    const queueList = await Promise.all(
      QUEUE_ALL.map(async (name: QueueName) => {
        try {
          const { getQueue } = await import('../../jobs/queues');
          const queue = getQueue(name);
          if (!queue) return { name, status: 'DISABLED', waiting: 0, active: 0, completed: 0, failed: 0 };
          const counts = (await queue.getJobCounts()) as Record<string, number>;
          return {
            name,
            status: 'UP',
            waiting: counts.wait ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
          };
        } catch {
          return { name, status: 'DOWN', waiting: 0, active: 0, completed: 0, failed: 0 };
        }
      }),
    );

    const healthy = Boolean(connection);
    return ApiResponse.success(res, {
      message: healthy ? SUCCESS.SYSTEM.HEALTH_OK : 'Queue not available.',
      result: {
        ...baseResult(),
        queue: healthy ? 'UP' : 'DISABLED',
        workerCount: getActiveWorkerCount(),
        queueList,
      },
    });
  }),
);

router.get(
  '/jobs/:jobId',
  asyncHandler(async (req, res) =>
    ApiResponse.success(res, {
      message: SUCCESS.BULK.STATUS_FETCHED,
      result: await getJobStatus(req.params.jobId),
    }),
  ),
);

export default router;