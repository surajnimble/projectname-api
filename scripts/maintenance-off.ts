/**
 * Ops kill switch for maintenance mode.
 *
 * The API escape hatch needs a SUPER_ADMIN token, which in turn needs a session
 * that can still be renewed. When neither holds — an expired refresh token, a
 * rotated secret, a half-finished deploy — this is the only way back: it writes
 * the setting directly and drops the Redis cache, so the very next request is
 * served normally. Run it on the machine that can reach the database.
 *
 *   npm run maintenance:off
 */
import { SETTING_CATEGORY, SETTING_KEY } from '../src/config/setting.config';
import { disconnectPrisma } from '../src/services/prisma.service';
import { disconnectRedis } from '../src/services/redis.service';
import { getMaintenanceStatus, setSetting } from '../src/services/settings.service';

const shutdown = async (): Promise<void> => {
  await disconnectRedis().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
};

const main = async (): Promise<void> => {
  /* eslint-disable no-console */
  const before = await getMaintenanceStatus();
  console.log(`[maintenance:off] was enabled=${before.enabled}`);

  await setSetting(
    SETTING_KEY.MAINTENANCE_ENABLED,
    false,
    SETTING_CATEGORY.SYSTEM,
    undefined,
    false,
  );

  const after = await getMaintenanceStatus();
  console.log(`[maintenance:off] now enabled=${after.enabled}`);
  console.log(`[maintenance:off] message left untouched: "${after.message}"`);
  /* eslint-enable no-console */

  if (after.enabled) {
    throw new Error('Still enabled after the write — inspect the SystemSetting row directly.');
  }
};

void main()
  .then(shutdown)
  .then(() => process.exit(0))
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('[maintenance:off] failed:', (err as Error)?.message ?? err);
    await shutdown();
    process.exit(1);
  });
