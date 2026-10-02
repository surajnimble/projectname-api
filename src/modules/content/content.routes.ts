import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, optionalAuth } from '../../middlewares/auth.middleware';
import * as controller from './content.controller';
import * as schema from './content.schema';

const router = Router();

// ── Pages ─────────────────────────────────────────────────────────────────────

/** GET /content/pages */
router.get(
  '/pages',
  optionalAuth,
  validate({ query: schema.listPagesSchema }),
  controller.listPages,
);

/** GET /content/pages/by-slug/:slug */
router.get(
  '/pages/by-slug/:slug',
  optionalAuth,
  validate({ params: schema.pageSlugParamSchema }),
  controller.getPageBySlug,
);

/** POST /content/pages/createPage */
router.post(
  '/pages/createPage',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createPageSchema }),
  controller.createPage,
);

/** PATCH /content/pages/updatePage/:id */
router.patch(
  '/pages/updatePage/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema, body: schema.updatePageSchema }),
  controller.updatePage,
);

/** DELETE /content/pages/deletePage/:id */
router.delete(
  '/pages/deletePage/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema }),
  controller.deletePage,
);

// ── Blog ──────────────────────────────────────────────────────────────────────

/** GET /content/blogs */
router.get(
  '/blogs',
  optionalAuth,
  validate({ query: schema.listBlogsSchema }),
  controller.listBlogs,
);

/** GET /content/blogs/by-slug/:slug */
router.get(
  '/blogs/by-slug/:slug',
  optionalAuth,
  validate({ params: schema.blogSlugParamSchema }),
  controller.getBlogBySlug,
);

/** POST /content/blogs/createBlog */
router.post(
  '/blogs/createBlog',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createBlogSchema }),
  controller.createBlog,
);

/** PATCH /content/blogs/updateBlog/:id */
router.patch(
  '/blogs/updateBlog/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema, body: schema.updateBlogSchema }),
  controller.updateBlog,
);

/** DELETE /content/blogs/deleteBlog/:id */
router.delete(
  '/blogs/deleteBlog/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema }),
  controller.deleteBlog,
);

// ── FAQ ───────────────────────────────────────────────────────────────────────

/** GET /content/faqs */
router.get('/faqs', validate({ query: schema.listFaqsSchema }), controller.listFaqs);

/** POST /content/faqs/createFaq */
router.post(
  '/faqs/createFaq',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createFaqSchema }),
  controller.createFaq,
);

/** PATCH /content/faqs/updateFaq/:id */
router.patch(
  '/faqs/updateFaq/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.faqIdParamSchema, body: schema.updateFaqSchema }),
  controller.updateFaq,
);

/** DELETE /content/faqs/deleteFaq/:id */
router.delete(
  '/faqs/deleteFaq/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.faqIdParamSchema }),
  controller.deleteFaq,
);

// ── Banners ───────────────────────────────────────────────────────────────────

/** GET /content/banners */
router.get('/banners', validate({ query: schema.listBannersSchema }), controller.listBanners);

/** POST /content/banners/createBanner */
router.post(
  '/banners/createBanner',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createBannerSchema }),
  controller.createBanner,
);

/** PATCH /content/banners/updateBanner/:id */
router.patch(
  '/banners/updateBanner/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.bannerIdParamSchema, body: schema.updateBannerSchema }),
  controller.updateBanner,
);

/** DELETE /content/banners/deleteBanner/:id */
router.delete(
  '/banners/deleteBanner/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.bannerIdParamSchema }),
  controller.deleteBanner,
);

// ── Contact ───────────────────────────────────────────────────────────────────

/** POST /content/contact — public */
router.post(
  '/contact',
  optionalAuth,
  validate({ body: schema.submitContactSchema }),
  controller.submitContact,
);

/** GET /content/contact/getAll — staff */
router.get(
  '/contact/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listContactsSchema }),
  controller.listContacts,
);

/** PATCH /content/contact/:id/markRead — staff */
router.patch(
  '/contact/:id/markRead',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema, body: schema.markContactReadSchema }),
  controller.markContactRead,
);

// ── Newsletter ────────────────────────────────────────────────────────────────

/** POST /content/newsletter/subscribe — public */
router.post(
  '/newsletter/subscribe',
  validate({ body: schema.subscribeSchema }),
  controller.subscribe,
);

/** POST /content/newsletter/unsubscribe — public, token based */
router.post(
  '/newsletter/unsubscribe',
  validate({ body: schema.unsubscribeSchema }),
  controller.unsubscribe,
);

/** GET /content/newsletter/getAll — staff */
router.get(
  '/newsletter/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listSubscribersSchema }),
  controller.listSubscribers,
);

// ── Geo ───────────────────────────────────────────────────────────────────────

/** GET /content/geo/countries */
router.get(
  '/geo/countries',
  validate({ query: schema.listCountriesSchema }),
  controller.listCountries,
);

/** GET /content/geo/states */
router.get('/geo/states', validate({ query: schema.listStatesSchema }), controller.listStates);

/** GET /content/geo/cities */
router.get('/geo/cities', validate({ query: schema.listCitiesSchema }), controller.listCities);

/** GET /content/geo/checkPincode */
router.get(
  '/geo/checkPincode',
  validate({ query: schema.checkPincodeSchema }),
  controller.checkPincode,
);

/** POST /content/geo/seedCountries — staff */
router.post('/geo/seedCountries', authenticate, ...controller.guards.admin, controller.seedCountries);

// ── Currency ──────────────────────────────────────────────────────────────────

/** GET /content/currencies */
router.get('/currencies', controller.listCurrencies);

/** GET /content/currencies/convert — declared before /:id so it is not shadowed */
router.get('/currencies/convert', controller.convertCurrency);

/** POST /content/currencies/create — staff */
router.post(
  '/currencies/create',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.currencySchema }),
  controller.createCurrency,
);

/** PATCH /content/currencies/:id/update — staff */
router.patch(
  '/currencies/:id/update',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema, body: schema.currencyUpdateSchema }),
  controller.updateCurrency,
);

/** DELETE /content/currencies/:id/delete — staff */
router.delete(
  '/currencies/:id/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema }),
  controller.deleteCurrency,
);

// ── Tax ───────────────────────────────────────────────────────────────────────

/** GET /content/taxConfigs */
router.get('/taxConfigs', controller.listTaxConfigs);

/** POST /content/taxConfigs/create — staff */
router.post(
  '/taxConfigs/create',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.taxConfigSchema }),
  controller.createTaxConfig,
);

/** PATCH /content/taxConfigs/:id/update — staff */
router.patch(
  '/taxConfigs/:id/update',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema, body: schema.taxConfigUpdateSchema }),
  controller.updateTaxConfig,
);

/** DELETE /content/taxConfigs/:id/delete — staff */
router.delete(
  '/taxConfigs/:id/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema }),
  controller.deleteTaxConfig,
);

// ── Translations ──────────────────────────────────────────────────────────────

/** GET /content/translations */
router.get(
  '/translations',
  validate({ query: schema.translationQuerySchema }),
  controller.listTranslations,
);

/** POST /content/translations/upsert — staff */
router.post(
  '/translations/upsert',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.translationSchema }),
  controller.upsertTranslations,
);

// ── Dropdowns ─────────────────────────────────────────────────────────────────

/** GET /content/dropdowns */
router.get(
  '/dropdowns',
  validate({ query: schema.dropdownQuerySchema }),
  controller.listDropdowns,
);

/** POST /content/dropdowns/create — staff */
router.post(
  '/dropdowns/create',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.dropdownSchema }),
  controller.createDropdown,
);

/** PATCH /content/dropdowns/:id/update — staff */
router.patch(
  '/dropdowns/:id/update',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema, body: schema.dropdownSchema.partial() }),
  controller.updateDropdown,
);

/** DELETE /content/dropdowns/:id/delete — staff */
router.delete(
  '/dropdowns/:id/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.contentIdParamSchema }),
  controller.deleteDropdown,
);

// ── Webhooks ──────────────────────────────────────────────────────────────────

/** GET /content/webhooks — staff */
router.get(
  '/webhooks',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listWebhooksSchema }),
  controller.listWebhooks,
);

/** POST /content/webhooks/receive — inbound, unauthenticated by design */
router.post('/webhooks/receive', controller.receiveWebhook);

/** POST /content/webhooks/register — staff */
router.post(
  '/webhooks/register',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createWebhookSchema }),
  controller.registerWebhook,
);

/** PATCH /content/webhooks/:id/update — staff */
router.patch(
  '/webhooks/:id/update',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.webhookIdParamSchema, body: schema.updateWebhookSchema }),
  controller.updateWebhook,
);

/** POST /content/webhooks/:id/rotateSecret — staff */
router.post(
  '/webhooks/:id/rotateSecret',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.webhookIdParamSchema }),
  controller.rotateSecret,
);

/** DELETE /content/webhooks/:id/delete — staff */
router.delete(
  '/webhooks/:id/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.webhookIdParamSchema }),
  controller.deleteWebhook,
);

/** GET /content/webhooks/logs — staff, declared after /:id routes */
router.get(
  '/webhooks/logs',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.webhookLogSchema }),
  controller.listWebhookLogs,
);

// ── Bulk jobs ─────────────────────────────────────────────────────────────────

/** POST /content/bulk/importProducts — vendors and staff */
router.post(
  '/bulk/importProducts',
  authenticate,
  validate({ body: schema.bulkProductsSchema }),
  controller.importProducts,
);

/** GET /content/bulk/getAll — vendors see their own jobs */
router.get(
  '/bulk/getAll',
  authenticate,
  validate({ query: schema.listJobsSchema }),
  controller.listBulkJobs,
);

/** GET /content/bulk/:jobId/status */
router.get(
  '/bulk/:jobId/status',
  authenticate,
  validate({ params: schema.jobIdParamSchema }),
  controller.getBulkJobStatus,
);

// ── Reports ───────────────────────────────────────────────────────────────────

/** GET /content/reports/schedules — staff */
router.get(
  '/reports/schedules',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listSchedulesSchema }),
  controller.listSchedules,
);

/** POST /content/reports/schedules/create — staff */
router.post(
  '/reports/schedules/create',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createScheduleSchema }),
  controller.createSchedule,
);

/** PATCH /content/reports/schedules/:id/update — staff */
router.patch(
  '/reports/schedules/:id/update',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.scheduleIdParamSchema, body: schema.createScheduleSchema.partial() }),
  controller.updateSchedule,
);

/** DELETE /content/reports/schedules/:id/delete — staff */
router.delete(
  '/reports/schedules/:id/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.scheduleIdParamSchema }),
  controller.deleteSchedule,
);

/** GET /content/reports/:type — staff */
router.get(
  '/reports/:type',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.reportSchema }),
  controller.runReport,
);

export const contentRoutes = router;
export default router;