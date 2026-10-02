/**
 * Prints a quick structural summary of the local PGlite database.
 * Useful to confirm a migration actually produced the expected objects.
 *
 * Usage: npx tsx scripts/db-status.ts
 */
import { PGlite } from '@electric-sql/pglite';

const DATA_DIR = process.env.PGLITE_DATA_DIR ?? 'pglite-data';

const main = async (): Promise<void> => {
  const db = await PGlite.create({ dataDir: DATA_DIR });

  try {
    const tables = await db.query<{ c: number }>(
      "SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const indexes = await db.query<{ c: number }>(
      "SELECT count(*)::int AS c FROM pg_indexes WHERE schemaname = 'public'",
    );
    const enums = await db.query<{ c: number }>(
      "SELECT count(*)::int AS c FROM pg_type WHERE typtype = 'e'",
    );
    const migrations = await db.query<{ migration_name: string; done: boolean }>(
      'SELECT migration_name, finished_at IS NOT NULL AS done FROM _prisma_migrations ORDER BY migration_name',
    );

    const version = await db.query<{ version: string }>('SELECT version()');

    /* eslint-disable no-console */
    console.log('postgres :', version.rows[0].version.split(' ').slice(0, 2).join(' '));
    console.log('tables   :', tables.rows[0].c);
    console.log('indexes  :', indexes.rows[0].c);
    console.log('enums    :', enums.rows[0].c);
    console.log('migrations:');
    for (const row of migrations.rows) {
      console.log(`  - ${row.migration_name} ${row.done ? '[applied]' : '[pending]'}`);
    }
    /* eslint-enable no-console */
  } finally {
    await db.close();
  }
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[db-status] failed:', err?.message ?? err);
  process.exit(1);
});