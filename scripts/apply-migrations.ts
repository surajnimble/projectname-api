import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const prisma = new PrismaClient();

interface Migration {
  name: string;
  sql: string;
}

const readMigrations = (): Migration[] => {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const sqlPath = path.join(MIGRATIONS_DIR, entry.name, 'migration.sql');
      return {
        name: entry.name,
        sql: fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '',
      };
    })
    .filter((m) => m.sql.trim().length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Splits a migration file into individual SQL statements, ignoring comments and blanks. */
const splitStatements = (sql: string): string[] =>
  sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

const main = async (): Promise<void> => {
  // Connects to DATABASE_URL (the TCP server started by `npm run db:up`),
  // so migrations land in the same database that `npm run seed` uses.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id            TEXT PRIMARY KEY,
      checksum      TEXT NOT NULL,
      finished_at   TIMESTAMPTZ,
      migration_name TEXT NOT NULL,
      logs          TEXT,
      rolled_back_at TIMESTAMPTZ,
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  );
  const appliedNames = new Set(applied.map((r) => r.migration_name));

  const migrations = readMigrations().filter((m) => !appliedNames.has(m.name));

  if (!migrations.length) {
    // eslint-disable-next-line no-console
    console.log('[migrate] nothing to apply — already up to date');
    return;
  }

  for (const migration of migrations) {
    // eslint-disable-next-line no-console
    console.log(`[migrate] applying ${migration.name} ...`);

    const statements = splitStatements(migration.sql);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }

    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
      VALUES (${crypto.randomUUID()}, 'manual', now(), ${migration.name}, 1)
    `;

    // eslint-disable-next-line no-console
    console.log(`[migrate] applied ${migration.name}`);
  }

  // eslint-disable-next-line no-console
  console.log('[migrate] all migrations applied');

  await prisma.$disconnect();
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err?.message ?? err);
  process.exit(1);
});
