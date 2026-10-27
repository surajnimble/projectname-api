import { prisma } from '../src/services/prisma.service';

const main = async (): Promise<void> => {
  const rows = await prisma.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  console.log('tables:', JSON.stringify(rows.map((r) => r.tablename)));
  await prisma.$disconnect();
};

main().catch((err) => {
  console.error('error:', err);
  process.exit(1);
});
