import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, '.env.example');

/**
 * Curated local-only environment template.
 *
 * This script intentionally does not read `.env`: copying arbitrary environment
 * values into an example file can leak credentials that were added after the
 * redaction list was written. Keep this template safe by construction.
 */
const SAFE_TEMPLATE = `# Local development template. Copy this file to .env and keep .env out of source control.
# This configuration is deliberately isolated from hosted/production infrastructure.
NODE_ENV=development
PORT=5000
APP_NAME=projectname
LOG_LEVEL=info

# Local PostgreSQL-compatible PGlite database only. Never replace this with a cloud URL for QA.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres?pgbouncer=true&connection_limit=1
PGLITE_MODE=true
PGLITE_PORT=5432
PGLITE_HOST=127.0.0.1
PGLITE_DATA_DIR=pglite-data
SEED_DEMO_DATA=true

# Development-only placeholder secrets. Replace locally before using accounts outside QA.
JWT_ACCESS_SECRET=local-development-access-secret-change-me
JWT_REFRESH_SECRET=local-development-refresh-secret-change-me
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SUPER_ADMIN_EMAIL=superadmin@projectname.local
SUPER_ADMIN_PASSWORD=LocalOnly-ChangeThis-Password-123!

# OTP may be read from the local server log; never use a static OTP in production.
OTP_REQUIRED=true
OTP_SMS_ENABLED=false
OTP_STATIC_CODE=111111

# Keep optional cloud integrations disabled in local QA.
REDIS_URL=
REDIS_PREFIX=projectname-local
QUEUE_ENABLED=false
QUEUE_PREFIX=projectname-local
WORKER_ENABLED=false
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=projectname-local
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=ProjectName
MAIL_FROM_NAME=ProjectName
MAIL_FROM_EMAIL=
BREVO_SENDER_NAME=
MSG91_AUTHKEY=
MSG91_SENDER_ID=
MSG91_TEMPLATE_ID=
MSG91_COUNTRY_CODE=91
FCM_SERVER_KEY=
FCM_ENABLED=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
STRIPE_KEY=
STRIPE_WEBHOOK_SECRET=
SHIPPING_PARTNER_WEBHOOK_SECRET=
ENCRYPTION_ENABLED=false
ENCRYPTION_KEY=

# Local browser origins only.
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SOCKET_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
TRACKING_ENABLED=true
GEO_LOOKUP_ENABLED=false
RATE_LIMIT_ENABLED=true
PUBLIC_API_URL=
`;

const main = (): void => {
  const next = SAFE_TEMPLATE.replace(/\r\n/g, '\n');
  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') : '';

  if (process.argv.includes('--check')) {
    if (current === next) {
      // eslint-disable-next-line no-console
      console.log('[env:check] .env.example matches the curated local-only template.');
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[env:check] .env.example is stale — run: npm run env:sync');
    process.exit(1);
  }

  if (current === next) {
    // eslint-disable-next-line no-console
    console.log('[env:sync] .env.example already matches the local-only template.');
    return;
  }

  fs.writeFileSync(TARGET, next, 'utf8');
  // eslint-disable-next-line no-console
  console.log('[env:sync] wrote the curated local-only template; no .env values were copied.');
};

main();
