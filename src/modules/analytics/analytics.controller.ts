import { Request } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { SUCCESS } from '../../messages/success';
import { asyncHandler } from '../../utils/asyncHandler';
import { D } from '../../utils/defaults';
import { getPagination } from '../../utils/pagination';
import { requireRole } from '../../middlewares/auth.middleware';
import { uploadFiles as uploadMiddleware, uploadSingle } from '../../middlewares/upload.middleware';
import { UPLOAD_KIND } from '../../config/upload.config';
import { getUploadedFiles } from '../../middlewares/upload.middleware';
import { uploadRateLimit } from '../../middlewares/rateLimit.middleware';
import * as service from './analytics.service';

const userId = (req: Request): string => req.auth!.userId;
const vendorId = (req: Request): string => req.auth!.vendorId;

export const guards = {
  admin: [requireRole('SUPER_ADMIN', 'SUB_ADMIN')],
};

// ═══ Tracking (client-facing) ════════════════════════════════════════════════

/**
 * @openapi
 * /tracking/event:
 *   post:
 *     tags: [Tracking]
 *     summary: Report a behaviour event
 *     description: Unknown event names are refused so analytics stay clean.
 *     responses:
 *       201: { description: Event recorded }
 *       400: { description: Unknown event name }
 */
export const trackEvent = asyncHandler(async (req, res) => {
  const result = await service.trackEvent(
    {
      name: D.str(req.body.name),
      sessionKey: D.str(req.body.sessionKey ?? req.sessionKey),
      meta: req.body.meta,
      userId: req.auth?.userId,
      deviceId: D.str(req.deviceId),
    },
    req,
  );

  return ApiResponse.created(res, SUCCESS.COMMON.SAVED, result);
});

/**
 * @openapi
 * /tracking/pageView:
 *   post:
 *     tags: [Tracking]
 *     summary: Record a page view
 *     responses:
 *       201: { description: View recorded }
 */
export const trackPageView = asyncHandler(async (req, res) => {
  const result = await service.trackPageView(req.body, req);
  return ApiResponse.created(res, SUCCESS.COMMON.SAVED, result);
});

/**
 * @openapi
 * /tracking/crash:
 *   post:
 *     tags: [Tracking]
 *     summary: Report a client crash
 *     responses:
 *       201: { description: Crash recorded }
 */
export const trackCrash = asyncHandler(async (req, res) => {
  const result = await service.trackCrash(req.body, req);
  return ApiResponse.created(res, SUCCESS.COMMON.SAVED, result);
});

/** POST /tracking/device — register or refresh a device token */
export const registerDevice = asyncHandler(async (req, res) => {
  const row = await service.registerDevice(req.body, req.auth?.userId, req);

  const { serializeDevice } = await import('../../utils/serialize');
  return ApiResponse.success(res, { message: SUCCESS.NOTIFICATION.DEVICE_REGISTERED, result: serializeDevice(row) });
});

/** GET /tracking/devices — the caller's own devices */
export const listDevices = asyncHandler(async (req, res) => {
  const rows = await service.listDevices(userId(req));

  const { serializeDevice } = await import('../../utils/serialize');
  return ApiResponse.success(res, {
    message: SUCCESS.NOTIFICATION.FETCHED,
    result: { itemCount: rows.length, itemList: rows.map(serializeDevice) },
  });
});

/** PATCH /tracking/devices/:deviceId/block — admin */
export const blockDevice = asyncHandler(async (req, res) => {
  const row = await service.toggleDeviceBlock(D.str(req.params.deviceId), true, req);

  const { serializeDevice } = await import('../../utils/serialize');
  return ApiResponse.success(res, { message: SUCCESS.COMMON.UPDATED, result: serializeDevice(row) });
});

// ═══ Analytics (admin) ══════════════════════════════════════════════════════

/** GET /analytics/overview */
export const overview = asyncHandler(async (req, res) => {
  const result = await service.getOverview(req.query);
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.OVERVIEW_FETCHED, result });
});

/** GET /analytics/visitors */
export const visitors = asyncHandler(async (req, res) => {
  const result = await service.getVisitors(req.query);
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.VISITORS_FETCHED, result });
});

/** GET /analytics/topPages */
export const topPages = asyncHandler(async (req, res) => {
  const rows = await service.getTopPages(req.query);
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.TOP_PAGES_FETCHED, result: { itemList: rows } });
});

/** GET /analytics/trafficSources */
export const trafficSources = asyncHandler(async (req, res) => {
  const rows = await service.getTrafficSources(req.query);
  return ApiResponse.success(res, {
    message: SUCCESS.ANALYTICS.TRAFFIC_SOURCES_FETCHED,
    result: { itemList: rows },
  });
});

/** GET /analytics/geo */
export const geoBreakdown = asyncHandler(async (req, res) => {
  const rows = await service.getGeoBreakdown(req.query);
  return ApiResponse.success(res, {
    message: SUCCESS.ANALYTICS.GEO_BREAKDOWN_FETCHED,
    result: { itemList: rows },
  });
});

/** GET /analytics/revenue */
export const revenue = asyncHandler(async (req, res) => {
  const result = await service.getRevenue(req.query);
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.REVENUE_FETCHED, result });
});

/** GET /analytics/productPerformance — a vendor sees only their own */
export const productPerformance = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const isVendor = req.auth!.role === 'VENDOR';

  const { rows, total } = await service.getProductPerformance(
    { ...(req.query as any), skip, take },
    isVendor ? vendorId(req) : undefined,
  );

  return ApiResponse.paginated(res, {
    message: SUCCESS.ANALYTICS.PRODUCT_PERFORMANCE_FETCHED,
    result: { itemList: rows },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /analytics/abandonedCarts */
export const abandonedCarts = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total, value } = await service.getAbandonedCarts({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ANALYTICS.ABANDONED_CARTS_FETCHED,
    result: { totalValue: D.float(value), itemList: rows },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /analytics/cohorts */
export const cohorts = asyncHandler(async (req, res) => {
  const result = await service.getCohorts(req.query);
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.COHORTS_FETCHED, result });
});

/** GET /analytics/realtime */
export const realtime = asyncHandler(async (_req, res) => {
  const result = await service.getRealtime();
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.REALTIME_FETCHED, result });
});

/** GET /analytics/searchTerms */
export const searchTerms = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.getSearchTerms({ ...(req.query as any), skip, take });

  const zeroResult = D.str(req.query?.hasResults as string) === 'false';

  return ApiResponse.paginated(res, {
    message: zeroResult
      ? SUCCESS.ANALYTICS.ZERO_RESULT_SEARCHES_FETCHED
      : SUCCESS.ANALYTICS.SEARCH_TERMS_FETCHED,
    result: {
      itemList: rows.map((r: any) => ({
        searchLogId: D.str(r.id),
        term: D.str(r.term),
        resultCount: D.num(r.resultCount),
        hasResults: D.bool(r.hasResults),
        createdAt: D.date(r.createdAt),
      })),
    },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

const D_arr = (v: any): any[] => (Array.isArray(v) ? v : []);

// ═══ Funnels ═════════════════════════════════════════════════════════════════

/** GET /analytics/funnels */
export const listFunnels = asyncHandler(async (_req, res) => {
  const rows = await service.listFunnels();

  return ApiResponse.success(res, {
    message: SUCCESS.ANALYTICS.FUNNEL_FETCHED,
    result: {
      itemCount: rows.length,
      itemList: rows.map((f: any) => ({
        funnelId: D.str(f.id),
        name: D.str(f.name),
        slug: D.str(f.slug),
        description: D.str(f.description),
        isActive: D.bool(f.isActive),
        stepCount: D.arr(f.steps).length,
        stepList: D.arr(f.steps).map((s: any) => ({
          stepId: D.str(s.id),
          name: D.str(s.name),
          eventName: D.str(s.eventName),
          sortOrder: D.num(s.sortOrder),
        })),
      })),
    },
  });
});

/** POST /analytics/funnels — admin */
export const createFunnel = asyncHandler(async (req, res) => {
  const row = await service.createFunnel(req.body, req);

  return ApiResponse.created(res, SUCCESS.COMMON.CREATED, {
    funnelId: D.str(row.id),
    name: D.str(row.name),
    slug: D.str(row.slug),
  });
});

/** PATCH /analytics/funnels/:id — admin */
export const updateFunnel = asyncHandler(async (req, res) => {
  const row = await service.updateFunnel(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, { message: SUCCESS.COMMON.UPDATED, result: { funnelId: D.str(row.id), isActive: D.bool(row.isActive) } });
});

/** GET /analytics/funnels/:slug */
export const getFunnel = asyncHandler(async (req, res) => {
  const result = await service.getFunnel(D.str(req.params.slug), req.query);
  return ApiResponse.success(res, { message: SUCCESS.ANALYTICS.FUNNEL_FETCHED, result });
});

// ═══ Search ══════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Global search across products, vendors and categories
 *     responses:
 *       200: { description: Grouped results }
 */
export const globalSearch = asyncHandler(async (req, res) => {
  const result = await service.globalSearch(req.query, req);
  return ApiResponse.success(res, { message: SUCCESS.SEARCH.GLOBAL_FETCHED, result });
});

/** GET /search/products */
export const searchProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.searchProducts({ ...(req.query as any), skip, take }, req);

  const { serializeProductSummary } = await import('../product/product.serializer');

  return ApiResponse.paginated(res, {
    message: SUCCESS.SEARCH.PRODUCTS_FETCHED,
    result: { itemList: rows.map(serializeProductSummary) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /search/vendors */
export const searchVendors = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.searchVendors({ ...(req.query as any), skip, take });

  const { serializeVendor } = await import('../../utils/serialize');

  return ApiResponse.paginated(res, {
    message: SUCCESS.SEARCH.VENDORS_FETCHED,
    result: { itemList: rows.map(serializeVendor) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /search/suggestions */
export const suggestions = asyncHandler(async (req, res) => {
  const rows = await service.getSuggestions(req.query);
  return ApiResponse.success(res, {
    message: SUCCESS.SEARCH.SUGGESTIONS_FETCHED,
    result: { itemCount: rows.length, suggestionList: rows },
  });
});

/** GET /search/trending */
export const trending = asyncHandler(async (req, res) => {
  const rows = await service.getTrendingSearches(req.query);
  return ApiResponse.success(res, {
    message: SUCCESS.SEARCH.TRENDING_FETCHED,
    result: { itemList: rows },
  });
});

/** GET /search/recent */
export const recent = asyncHandler(async (req, res) => {
  const rows = await service.getRecentSearches(userId(req), req);
  return ApiResponse.success(res, {
    message: SUCCESS.SEARCH.RECENT_FETCHED,
    result: { itemCount: rows.length, termList: rows },
  });
});

/** POST /search/recent/clear */
export const clearRecent = asyncHandler(async (req, res) => {
  const count = await service.clearRecentSearches(userId(req));
  return ApiResponse.success(res, { message: SUCCESS.SEARCH.RECENT_CLEARED, result: { clearedCount: D.num(count) } });
});

// ═══ Uploads ═════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /upload/image:
 *   post:
 *     tags: [Upload]
 *     summary: Upload one or more images
 *     responses:
 *       201: { description: Uploaded asset descriptors }
 *       413: { description: File too large }
 *       415: { description: Unsupported type }
 */
export const uploadImage = asyncHandler(async (req, res) => {
  const result = await service.uploadFiles(getUploadedFiles(req), UPLOAD_KIND.IMAGE, req.auth?.userId, req);
  return ApiResponse.created(res, SUCCESS.UPLOAD.IMAGE_UPLOADED, result);
});

/** POST /upload/document — admin */
export const uploadDocument = asyncHandler(async (req, res) => {
  const result = await service.uploadFiles(getUploadedFiles(req), UPLOAD_KIND.DOCUMENT, req.auth?.userId, req);
  return ApiResponse.created(res, SUCCESS.UPLOAD.DOCUMENT_UPLOADED, result);
});

/** POST /upload/kyc — a vendor uploads compliance documents */
export const uploadKyc = asyncHandler(async (req, res) => {
  const result = await service.uploadFiles(getUploadedFiles(req), UPLOAD_KIND.KYC, req.auth?.userId, req);
  return ApiResponse.created(res, SUCCESS.UPLOAD.DOCUMENT_UPLOADED, result);
});

/**
 * @openapi
 * /upload/delete:
 *   post:
 *     tags: [Upload]
 *     summary: Delete a stored asset by public id
 *     responses:
 *       200: { description: Deleted }
 */
export const removeFile = asyncHandler(async (req, res) => {
  const result = await service.deleteFile(D.str(req.body.publicId), req.auth?.userId, req);
  return ApiResponse.success(res, { message: SUCCESS.UPLOAD.DELETED, result });
});

/**
 * @openapi
 * /upload/signed-params:
 *   get:
 *     tags: [Upload]
 *     summary: Direct-to-CDN upload signature
 *     description: Lets a large file bypass the API entirely.
 *     responses:
 *       200: { description: Signature and upload parameters }
 *       503: { description: Storage not configured }
 */
export const signedParams = asyncHandler(async (req, res) => {
  const result = await service.getSignedParams(userId(req), D.str(req.query?.kind as string) || 'common');
  return ApiResponse.success(res, { message: SUCCESS.UPLOAD.SIGNED_URL_FETCHED, result });
});

export { uploadMiddleware, uploadSingle, uploadRateLimit };