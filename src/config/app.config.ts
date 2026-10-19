import { ENV } from './env.config';

export const APP = {
  NAME: ENV.APP_NAME,
  API_PREFIX: '/api/v1',
  SERVER_NAME: `${ENV.APP_NAME}-api`,
  DEFAULT_PORT: 5000,
  DEFAULT_LOCALE: 'en',
  DEFAULT_TIMEZONE: 'Asia/Kolkata',
  DEFAULT_CURRENCY: 'INR',
  DEFAULT_DATE_FORMAT: 'DD-MM-YYYY',
  DEFAULT_TIME_FORMAT: 'hh:mm A',
  REQUEST_TIMEOUT_MS: 30_000,
  BODY_LIMIT: '1mb',
  JSON_LIMIT: '1mb',
  URLENCODED_LIMIT: '1mb',
  SHUTDOWN_TIMEOUT_MS: 15_000,
  VERSION: 'v1',
};

export const SERVER = {
  PORT: ENV.PORT,
  HOST: '0.0.0.0',
  NODE_ENV: ENV.NODE_ENV,
};

export const OPS = {
  JOB_BATCH_SIZE: 5000,
  BULK_MAX_ROWS: 5000,
  NOTIFICATION_BODY_MAX_CHARS: 160,
  TX_MAX_WAIT_MS: 5000,
  TX_TIMEOUT_MS: 15_000,
} as const;

export const HEADER = {
  REQUEST_ID: 'x-request-id',
  RESPONSE_REQUEST_ID: 'X-Request-Id',
  DEVICE_ID: 'x-device-id',
  PLATFORM: 'x-platform',
  APP_VERSION: 'x-app-version',
  DEVICE_MODEL: 'x-device-model',
  LOCALE: 'x-locale',
  TIMEZONE: 'x-timezone',
  FCM_TOKEN: 'x-fcm-token',
  ENCRYPTED: 'x-encrypted',
  SESSION_ID: 'x-session-id',
  API_KEY: 'x-api-key',
  SIGNATURE: 'x-signature',
  IDEMPOTENCY_KEY: 'idempotency-key',
  IDEMPOTENCY_REPLAYED: 'x-idempotency-replayed',
  REFRESH_TOKEN: 'refreshToken',
} as const;

export const SKIP_ENCRYPTION_PATHS = ['/health', '/docs', '/docs.json', '/webhooks', '/track'];

/**
 * Header-supplied device facts are truncated to these lengths before they reach
 * a column or a cache key, so an oversized value cannot push a row past its
 * limit or split one device into two identities.
 */
export const DEVICE_HEADER_MAX = {
  ID: 64,
  APP_VERSION: 30,
  MODEL: 80,
  LOCALE: 20,
  TIMEZONE: 60,
  FCM_TOKEN: 400,
} as const;

/**
 * A client that is too old to keep working still has to be able to discover
 * which build to install, so the routes that serve that fact stay reachable
 * while every other route is closed to it.
 */
export const APP_VERSION_ALLOW_PATHS = [
  '/health',
  '/version',
  '/docs',
  '/settings/getPublicSettings',
] as const;

/**
 * Retained keys outlive the window a client is expected to retry in, so a late
 * retry is still answered from the stored response rather than double-charging.
 */
export const IDEMPOTENCY = {
  KEY_MIN_LENGTH: 8,
  KEY_MAX_LENGTH: 120,
  RETENTION_HOURS: 24,
  IN_PROGRESS_MAX_AGE_SEC: 120,
} as const;
export const MAINTENANCE_ALLOW_PATHS = [
  '/health',
  '/docs',
  '/docs.json',
  '/version',
  '/settings/getMaintenance',
];
export const MAINTENANCE_ADMIN_PATHS = ['/admin'];
