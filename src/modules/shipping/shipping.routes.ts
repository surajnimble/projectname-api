import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './shipping.controller';
import * as schema from './shipping.schema';

const router = Router();

// ── Zones ─────────────────────────────────────────────────────────────────────

/** GET /shipping/zones/getAll */
router.get(
  '/zones/getAll',
  authenticate,
  validate({ query: schema.listZonesSchema }),
  controller.zoneList,
);

/** POST /shipping/zones/createZone */
router.post(
  '/zones/createZone',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createZoneSchema }),
  controller.zoneCreate,
);

/** PATCH /shipping/zones/updateZone/:id */
router.patch(
  '/zones/updateZone/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.zoneIdParamSchema, body: schema.updateZoneSchema }),
  controller.zoneUpdate,
);

/** DELETE /shipping/zones/deleteZone/:id */
router.delete(
  '/zones/deleteZone/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.zoneIdParamSchema }),
  controller.zoneDelete,
);

// ── Methods ───────────────────────────────────────────────────────────────────

/** GET /shipping/methods/getAll */
router.get(
  '/methods/getAll',
  authenticate,
  validate({ query: schema.listMethodsSchema }),
  controller.methodList,
);

/** POST /shipping/methods/createMethod */
router.post(
  '/methods/createMethod',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createMethodSchema }),
  controller.methodCreate,
);

/** PATCH /shipping/methods/updateMethod/:id */
router.patch(
  '/methods/updateMethod/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.zoneIdParamSchema, body: schema.updateMethodSchema }),
  controller.methodUpdate,
);

/** DELETE /shipping/methods/deleteMethod/:id */
router.delete(
  '/methods/deleteMethod/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.zoneIdParamSchema }),
  controller.methodDelete,
);

// ── Partners ──────────────────────────────────────────────────────────────────

/** GET /shipping/partners/getAll */
router.get(
  '/partners/getAll',
  authenticate,
  validate({ query: schema.listMethodsSchema }),
  controller.partnerList,
);

/** POST /shipping/partners/createPartner */
router.post(
  '/partners/createPartner',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createPartnerSchema }),
  controller.partnerCreate,
);

/** PATCH /shipping/partners/updatePartner/:id */
router.patch(
  '/partners/updatePartner/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.partnerIdParamSchema, body: schema.updatePartnerSchema }),
  controller.partnerUpdate,
);

// ── Serviceability ────────────────────────────────────────────────────────────

/** POST /shipping/checkServiceable */
router.post(
  '/checkServiceable',
  authenticate,
  validate({ body: schema.checkServiceableSchema }),
  controller.checkServiceable,
);

/** POST /shipping/calculateRate */
router.post(
  '/calculateRate',
  authenticate,
  validate({ body: schema.calculateRateSchema }),
  controller.calculateRate,
);

// ── Shipments ─────────────────────────────────────────────────────────────────

/** PATCH /shipping/shipments/updateStatus/:id */
router.patch(
  '/shipments/updateStatus/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.zoneIdParamSchema, body: schema.toggleDeliveryBoySchema }),
  controller.shipmentStatus,
);

// ── Delivery boys ─────────────────────────────────────────────────────────────

/** GET /shipping/delivery-boys/getAll */
router.get(
  '/delivery-boys/getAll',
  authenticate,
  validate({ query: schema.listDeliveryBoysSchema }),
  controller.deliveryBoyList,
);

/** POST /shipping/delivery-boys/createDeliveryBoy */
router.post(
  '/delivery-boys/createDeliveryBoy',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createDeliveryBoySchema }),
  controller.deliveryBoyCreate,
);

/** PATCH /shipping/delivery-boys/updateDeliveryBoy/:id */
router.patch(
  '/delivery-boys/updateDeliveryBoy/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.deliveryBoyIdParamSchema, body: schema.updateDeliveryBoySchema }),
  controller.deliveryBoyUpdate,
);

/** PATCH /shipping/delivery-boys/toggleStatus/:id */
router.patch(
  '/delivery-boys/toggleStatus/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.deliveryBoyIdParamSchema, body: schema.toggleDeliveryBoySchema }),
  controller.deliveryBoyToggle,
);

/** DELETE /shipping/delivery-boys/deleteDeliveryBoy/:id */
router.delete(
  '/delivery-boys/deleteDeliveryBoy/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.deliveryBoyIdParamSchema }),
  controller.deliveryBoyDelete,
);

/** GET /shipping/delivery-boys/getDeliveries */
router.get(
  '/delivery-boys/getDeliveries',
  authenticate,
  validate({ query: schema.listDeliveryBoysSchema }),
  controller.deliveryList,
);

export const shippingRoutes = router;

// ── Settings ──────────────────────────────────────────────────────────────────

const settings = Router();

/** GET /settings/getPublic */
settings.get('/getPublic', authenticate, controller.settingsPublic);

/** GET /settings/getAll */
settings.get(
  '/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listSettingsSchema }),
  controller.settingsList,
);

/** PATCH /settings/update */
settings.patch(
  '/update',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.updateSettingSchema }),
  controller.settingsUpdate,
);

/** PATCH /settings/bulkUpdate */
settings.patch(
  '/bulkUpdate',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.bulkUpdateSettingsSchema }),
  controller.settingsBulkUpdate,
);

export const settingsRoutes = settings;

// ── Admin ─────────────────────────────────────────────────────────────────────

const admin = Router();

/** GET /admin/dashboard */
admin.get('/dashboard', authenticate, ...controller.guards.admin, controller.dashboard);

/** GET /admin/health */
admin.get('/health', authenticate, ...controller.guards.admin, controller.health);

/** POST /admin/sub-admins — super admin only */
admin.post(
  '/sub-admins',
  authenticate,
  ...controller.guards.superAdmin,
  validate({ body: schema.createSubAdminSchema }),
  controller.subAdminCreate,
);

/** GET /admin/sub-admins */
admin.get(
  '/sub-admins',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listSettingsSchema }),
  controller.subAdminList,
);

/** GET /admin/permissions/:role */
admin.get(
  '/permissions/:role',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.roleParamSchema }),
  controller.permissionsGet,
);

/** PATCH /admin/permissions/:role */
admin.patch(
  '/permissions/:role',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.roleParamSchema, body: schema.setPermissionsSchema }),
  controller.permissionsSet,
);

/** GET /admin/audit-logs */
admin.get(
  '/audit-logs',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listAuditLogsSchema }),
  controller.auditLogs,
);

/** GET /admin/activity-logs */
admin.get(
  '/activity-logs',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listActivityLogsSchema }),
  controller.activityLogs,
);

/** GET /admin/api-keys */
admin.get('/api-keys', authenticate, ...controller.guards.admin, controller.apiKeyList);

/** POST /admin/api-keys */
admin.post(
  '/api-keys',
  authenticate,
  ...controller.guards.superAdmin,
  validate({ body: schema.createApiKeySchema }),
  controller.apiKeyCreate,
);

/** POST /admin/api-keys/revoke/:id */
admin.post(
  '/api-keys/revoke/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.apiKeyIdParamSchema }),
  controller.apiKeyRevoke,
);

/** DELETE /admin/api-keys/:id */
admin.delete(
  '/api-keys/:id',
  authenticate,
  ...controller.guards.superAdmin,
  validate({ params: schema.apiKeyIdParamSchema }),
  controller.apiKeyDelete,
);

export const adminRoutes = admin;