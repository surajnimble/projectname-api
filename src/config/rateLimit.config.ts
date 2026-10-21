export const RATE_LIMIT = {
  GLOBAL: { WINDOW_MS: 15 * 60_000, MAX: 3000 }, // 200 req/min — raise MAX
  AUTH_LOGIN: { WINDOW_MS: 15 * 60_000, MAX: 10 }, // 1 per 90s — raise MAX
  AUTH_REGISTER: { WINDOW_MS: 60 * 60_000, MAX: 5 }, // 1 per 12 min — raise MAX
  FORGOT_PASSWORD: { WINDOW_MS: 60 * 60_000, MAX: 3 }, // 1 per 20 min — raise MAX
  OTP_SEND: { WINDOW_MS: 60_000, MAX: 1 }, // 1 req/min — raise MAX
  OTP_VERIFY: { WINDOW_MS: 15 * 60_000, MAX: 10 }, // 1 per 90s — raise MAX
  UPLOAD: { WINDOW_MS: 60_000, MAX: 20 }, // 20 req/min — raise MAX
  SEARCH: { WINDOW_MS: 60_000, MAX: 60 }, // 60 req/min — raise MAX
  TRACKING: { WINDOW_MS: 60_000, MAX: 600 }, // 600 req/min — raise MAX
  ANALYTICS: { WINDOW_MS: 60_000, MAX: 120 }, // 120 req/min — raise MAX
  PAYMENT: { WINDOW_MS: 60_000, MAX: 30 }, // 30 req/min — raise MAX
  EXPORT: { WINDOW_MS: 60_000, MAX: 5 }, // 5 req/min — raise MAX
  PASSWORD_RESET: { WINDOW_MS: 60 * 60_000, MAX: 5 }, // 1 per 12 min — raise MAX
  ENABLE_2FA: { WINDOW_MS: 60 * 60_000, MAX: 5 }, // 1 per 12 min — raise MAX
  SOCIAL_LOGIN: { WINDOW_MS: 60_000, MAX: 20 }, // 20 req/min — raise MAX
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT;

export const RATE_LIMIT_MESSAGE = 'Too many requests, please try again later.';

export const REDIS_RATE_LIMIT_PREFIX = 'rl:';

export const LOGIN_ATTEMPT = {
  MAX_ATTEMPTS: 5,
  LOCK_MINUTES: 15,
  WINDOW_MINUTES: 15,
};
