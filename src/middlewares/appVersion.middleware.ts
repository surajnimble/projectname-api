import type { RequestHandler } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { isVersionOlderThan } from '../utils/version';
import { getAppUpdatePolicy } from '../services/settings.service';
import { APP, APP_VERSION_ALLOW_PATHS } from '../config/app.config';
import { PLATFORM } from '../constants/roles';
import { ERROR } from '../messages/error';
import { ERROR_CODE, HTTP_STATUS } from '../constants/http';

/**
 * Platforms the gate may ever block.
 *
 * A browser cannot act on an upgrade prompt, so holding it to a mobile build's
 * minimum version would lock web users out of the API entirely.
 */
const GATED_PLATFORMS: readonly string[] = [PLATFORM.ANDROID, PLATFORM.IOS];

/**
 * Paths that stay open to a client too old to use the app.
 *
 * Without them the client could never learn which build to install — the
 * update screen it needs to render is driven by these very endpoints.
 */
const ALLOW_PATHS = APP_VERSION_ALLOW_PATHS.map((path) =>
  path.startsWith(APP.API_PREFIX) ? path.slice(APP.API_PREFIX.length) || '/' : path,
);

const isAllowedPath = (path: string): boolean => {
  const target = path.startsWith(APP.API_PREFIX) ? path.slice(APP.API_PREFIX.length) || '/' : path;
  return ALLOW_PATHS.some((entry) => target === entry || target.startsWith(`${entry}/`));
};

/**
 * Closes the API to app builds older than the configured minimum.
 *
 * Only `ANDROID` and `IOS` are version-gated, and only while the matching
 * force-update switch is on. A browser, a server-to-server caller or a request
 * carrying no `x-app-version` is never blocked, because none of them can act on
 * an upgrade prompt. Runs after the tracking middleware, which is what reads
 * the platform and version headers.
 */
export const appVersionGuard: RequestHandler = async (req, res, next) => {
  if (isAllowedPath(req.path)) return next();

  const appVersion = req.device?.appVersion ?? '';
  if (!appVersion) return next();

  const platform = (req.device?.platform ?? '').toUpperCase();
  if (!GATED_PLATFORMS.includes(platform)) return next();

  const policy = await getAppUpdatePolicy(platform).catch(() => null);
  if (!policy) return next();

  const mustUpdate = policy.forceUpdate && isVersionOlderThan(appVersion, policy.minVersion);
  if (!mustUpdate) return next();

  return ApiResponse.error(res, {
    statusCode: HTTP_STATUS.UPGRADE_REQUIRED,
    message: policy.message || ERROR.APP.UPDATE_REQUIRED,
    code: ERROR_CODE.APP_UPDATE_REQUIRED,
  });
};
