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

/**
 * Splits a migration file into individual SQL statements.
 *
 * A naive split on `;` is wrong: the file is full of enum lists written as
 * `CREATE TYPE "Foo" AS ENUM ('A', 'B', 'C')`, and the commas inside those
 * literals are not statement boundaries. The naive version collapsed the
 * whole file into one statement, which PGlite then rejected — while the
 * migration row was still recorded as finished, so the next run saw nothing to
 * apply and left the schema empty.
 *
 * The scanner walks the SQL once, tracking whether it is inside a single-quoted
 * string or a dollar-quoted block, and only treats a `;` as a boundary when
 * neither is open. Line comments (`--`) are skipped as before.
 */
const splitStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let inSingle = false;
  let inDollarTag = '';

  while (i < sql.length) {
    const char = sql[i];

    if (inDollarTag) {
      current += char;
      if (sql.startsWith(inDollarTag, i)) {
        i += inDollarTag.length;
        continue;
      }
      i += 1;
      continue;
    }

    if (inSingle) {
      current += char;
      if (char === '\\' && i + 1 < sql.length) {
        current += sql[i + 1];
        i += 2;
        continue;
      }
      if (char === "'") inSingle = false;
      i += 1;
      continue;
    }

    if (char === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end + 1;
      continue;
    }

    if (char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_0-9]*\$/);
      if (match) {
        inDollarTag = match[0];
        current += inDollarTag;
        i += inDollarTag.length;
        continue;
      }
    }

    if (char === "'") {
      inSingle = true;
      current += char;
      i += 1;
      continue;
    }

    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);
  return statements;
};

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
