import 'dotenv/config';

/**
 * Minimal Prisma connectivity check used to debug local database access.
 * Usage: npx tsx scripts/prisma-probe.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async (): Promise<void> => {
  /* eslint-disable no-console */
  try {
    const raw = await prisma.$queryRawUnsafe<{ ok: number }>('SELECT 1 AS ok');
    console.log('raw query      :', raw[0]?.ok === 1 ? 'OK' : 'UNEXPECTED');

    const tableCount = await prisma.$queryRawUnsafe<{ c: number }>(
      "SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public'",
    );
    console.log('public tables  :', tableCount[0]?.c);

    const settings = await prisma.systemSetting.count();
    console.log('SystemSetting  :', settings);

    const users = await prisma.user.count();
    console.log('User           :', users);

    const created = await prisma.systemSetting.upsert({
      where: { key: '__probe__' },
      create: { key: '__probe__', value: { ok: true }, category: 'system', isPublic: false },
      update: { value: { ok: true } },
      select: { id: true, key: true, category: true },
    });
    console.log('upsert         :', created.key, '/', created.category);

    const found = await prisma.systemSetting.findUnique({
      where: { key: '__probe__' },
      select: { key: true, value: true },
    });
    console.log('findUnique     :', found?.key);

    await prisma.systemSetting.delete({ where: { key: '__probe__' } });
    console.log('delete         : OK');

    console.log('\nRESULT: Prisma Client works end-to-end.');
  } catch (err) {
    console.error('\nRESULT: FAILED —', (err as Error)?.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
  /* eslint-enable no-console */
};

void main();
