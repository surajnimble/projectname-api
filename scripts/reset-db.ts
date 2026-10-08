import { execSync } from 'child_process';

const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&statement_cache_size=0&connection_limit=1';

// Delete existing data and migrations
execSync('rm -rf pglite-data');
execSync('rm -rf prisma/migrations');
execSync('rm -rf prisma/migrations-test');

// Set env and create initial migration
process.env.DATABASE_URL = dbUrl;
execSync('npx prisma migrate make init --create-db', { stdio: 'inherit' });

console.log('Migration created successfully');