import { execSync } from 'child_process';

const dbUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&statement_cache_size=0&connection_limit=1';

// Delete existing data and migrations
try { execSync('rm -rf pglite-data', { stdio: 'inherit' }); } catch {}
try { execSync('rm -rf prisma/migrations', { stdio: 'inherit' }); } catch {}
try { execSync('rm -rf prisma/migrations-test', { stdio: 'inherit' }); } catch {}

// Set env and create initial migration
process.env.DATABASE_URL = dbUrl;
execSync('npx prisma migrate make init --create-db', { stdio: 'inherit' });

console.log('Migration created successfully');