/**
 * Seeds a database only when it has never been seeded.
 *
 * The container entrypoint runs on every cold start, so an unconditional seed
 * would add work to every boot. A complete first boot leaves both settings and
 * users behind; either missing means the earlier seed did not finish.
 */
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  const [users, settings] = await Promise.all([prisma.user.count(), prisma.systemSetting.count()]);

  if (users > 0 && settings > 0) {
    // eslint-disable-next-line no-console
    console.log(`[seed-if-empty] already seeded (${users} users, ${settings} settings)`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[seed-if-empty] empty database (${users} users, ${settings} settings), seeding`);

  execFileSync('npx', ['--no-install', 'tsx', 'prisma/seed.ts'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
};

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-if-empty] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
