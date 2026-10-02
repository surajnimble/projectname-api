import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, optionalAuth } from '../../middlewares/auth.middleware';
import { uploadFiles, uploadSingle } from '../../middlewares/upload.middleware';
import { uploadRateLimit } from '../../middlewares/rateLimit.middleware';
import { UPLOAD_KIND } from '../../config/upload.config';
import * as controller from './analytics.controller';
import * as schema from './analytics.schema';

const router = Router();

// ── Tracking ─────────────────────────────────────────────────────────────────
// Client-facing, so mostly optionalAuth: an anonymous visitor is still tracked
// and the session key ties the events together.

router.post(
  '/event',
  optionalAuth,
  validate({ body: schema.trackEventSchema }),
  controller.trackEvent,
);

router.post(
  '/pageView',
  optionalAuth,
  validate({ body: schema.trackPageViewSchema }),
  controller.trackPageView,
);

router.post(
  '/crash',
  optionalAuth,
  validate({ body: schema.trackCrashSchema }),
  controller.trackCrash,
);

router.post(
  '/device',
  optionalAuth,
  validate({ body: schema.registerDeviceSchema }),
  controller.registerDevice,
);

router.get('/devices', authenticate, controller.listDevices);

router.patch(
  '/devices/:deviceId/block',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.deviceIdParamSchema }),
  controller.blockDevice,
);

// ── Analytics (admin) ────────────────────────────────────────────────────────

router.get('/overview', authenticate, ...controller.guards.admin, validate({ query: schema.rangeSchema }), controller.overview);
router.get('/visitors', authenticate, ...controller.guards.admin, validate({ query: schema.rangeSchema }), controller.visitors);
router.get('/topPages', authenticate, ...controller.guards.admin, validate({ query: schema.topPagesSchema }), controller.topPages);
router.get('/trafficSources', authenticate, ...controller.guards.admin, validate({ query: schema.rangeSchema }), controller.trafficSources);
router.get('/geo', authenticate, ...controller.guards.admin, validate({ query: schema.rangeSchema }), controller.geoBreakdown);
router.get('/revenue', authenticate, ...controller.guards.admin, validate({ query: schema.revenueSchema }), controller.revenue);
router.get('/productPerformance', authenticate, validate({ query: schema.productPerformanceSchema }), controller.productPerformance);
router.get('/abandonedCarts', authenticate, ...controller.guards.admin, validate({ query: schema.abandonedCartsSchema }), controller.abandonedCarts);
router.get('/cohorts', authenticate, ...controller.guards.admin, validate({ query: schema.rangeSchema }), controller.cohorts);
router.get('/realtime', authenticate, ...controller.guards.admin, controller.realtime);
router.get('/searchTerms', authenticate, ...controller.guards.admin, validate({ query: schema.searchLogsSchema }), controller.searchTerms);

// ── Funnels ──────────────────────────────────────────────────────────────────

router.get('/funnels', authenticate, ...controller.guards.admin, controller.listFunnels);
router.post(
  '/funnels',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createFunnelSchema }),
  controller.createFunnel,
);
router.patch(
  '/funnels/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.funnelIdParamSchema, body: schema.updateFunnelSchema }),
  controller.updateFunnel,
);
router.get(
  '/funnels/:slug',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.funnelSlugParamSchema, query: schema.rangeSchema }),
  controller.getFunnel,
);

export const trackingRoutes = router;
export const analyticsRoutes = router;

// ── Search (public) ──────────────────────────────────────────────────────────

const search = Router();

/** GET /search — global, works signed-out. */
search.get('/', optionalAuth, validate({ query: schema.globalSearchSchema }), controller.globalSearch);

search.get('/products', optionalAuth, validate({ query: schema.searchProductsSchema }), controller.searchProducts);

search.get('/vendors', optionalAuth, validate({ query: schema.searchVendorsSchema }), controller.searchVendors);

search.get('/suggestions', optionalAuth, validate({ query: schema.globalSearchSchema }), controller.suggestions);

search.get('/trending', optionalAuth, validate({ query: schema.trendingSearchSchema }), controller.trending);

search.get('/recent', authenticate, controller.recent);

search.post('/recent/clear', authenticate, controller.clearRecent);

export const searchRoutes = search;

// ── Uploads ──────────────────────────────────────────────────────────────────

const upload = Router();

/** POST /upload/image */
upload.post(
  '/image',
  authenticate,
  uploadRateLimit,
  uploadFiles(UPLOAD_KIND.IMAGE, 'files'),
  controller.uploadImage,
);

/** POST /upload/image/single */
upload.post(
  '/image/single',
  authenticate,
  uploadRateLimit,
  uploadSingle(UPLOAD_KIND.IMAGE, 'file'),
  controller.uploadImage,
);

/** POST /upload/document — admin */
upload.post(
  '/document',
  authenticate,
  ...controller.guards.admin,
  uploadRateLimit,
  uploadFiles(UPLOAD_KIND.DOCUMENT, 'files'),
  controller.uploadDocument,
);

/** POST /upload/kyc — a vendor uploads compliance papers */
upload.post(
  '/kyc',
  authenticate,
  uploadRateLimit,
  uploadFiles(UPLOAD_KIND.KYC, 'files'),
  controller.uploadKyc,
);

/** GET /upload/signed-params */
upload.get('/signed-params', authenticate, validate({ query: schema.signedUrlSchema }), controller.signedParams);

/** POST /upload/delete */
upload.post(
  '/delete',
  authenticate,
  validate({ body: schema.deleteFileSchema }),
  controller.removeFile,
);

export const uploadRoutes = upload;