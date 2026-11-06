import { Router } from 'express';
import { validate, idParamSchema } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { PERMISSION } from '../../constants/permissions';
import * as controller from './shipping.controller';
import * as schema from './shipping.schema';

const router = Router();

router.get(
  '/getZones',
  authenticate,
  validate({ query: schema.listZonesSchema }),
  controller.zoneList,
);

router.post(
  '/createZone',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ body: schema.createZoneSchema }),
  controller.zoneCreate,
);

router.patch(
  '/updateZone/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.zoneIdParamSchema, body: schema.updateZoneSchema }),
  controller.zoneUpdate,
);

router.delete(
  '/deleteZone/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.zoneIdParamSchema }),
  controller.zoneDelete,
);

router.patch(
  '/toggleZone/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.zoneIdParamSchema, body: schema.toggleZoneSchema }),
  controller.zoneToggle,
);

router.get(
  '/getMethods',
  authenticate,
  validate({ query: schema.listMethodsSchema }),
  controller.methodList,
);

router.post(
  '/createMethod',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ body: schema.createMethodSchema }),
  controller.methodCreate,
);

router.patch(
  '/updateMethod/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.zoneIdParamSchema, body: schema.updateMethodSchema }),
  controller.methodUpdate,
);

router.delete(
  '/deleteMethod/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.zoneIdParamSchema }),
  controller.methodDelete,
);

router.get(
  '/getPartners',
  authenticate,
  validate({ query: schema.listMethodsSchema }),
  controller.partnerList,
);

router.post(
  '/createPartner',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ body: schema.createPartnerSchema }),
  controller.partnerCreate,
);

router.patch(
  '/updatePartner/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.partnerIdParamSchema, body: schema.updatePartnerSchema }),
  controller.partnerUpdate,
);

router.delete(
  '/deletePartner/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: schema.partnerIdParamSchema }),
  controller.partnerDelete,
);

router.post(
  '/checkServiceability',
  authenticate,
  validate({ body: schema.checkServiceableSchema }),
  controller.checkServiceable,
);

router.post(
  '/calculateRate',
  authenticate,
  validate({ body: schema.calculateRateSchema }),
  controller.calculateRate,
);

router.post(
  '/createShipment/:subOrderId',
  authenticate,
  ...controller.guards.vendor,
  validate({ params: schema.subOrderIdParamSchema, body: schema.createShipmentSchema }),
  controller.shipmentCreate,
);

router.get('/track/:awb', validate({ params: schema.awbParamSchema }), controller.shipmentTrack);

// Staff-only lookup for the dashboard. The public customer tracking route remains unchanged.
router.get(
  '/admin/track/:awb',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.TRACKING_VIEW),
  validate({ params: schema.awbParamSchema }),
  controller.shipmentTrack,
);

router.patch(
  '/updateStatus/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SHIPPING_MANAGE),
  validate({ params: idParamSchema, body: schema.shipmentStatusSchema }),
  controller.shipmentStatus,
);

export const shippingRoutes = router;

const deliveryBoy = Router();

deliveryBoy.get(
  '/getAll',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.DELIVERY_BOY_MANAGE),
  validate({ query: schema.listDeliveryBoysSchema }),
  controller.deliveryBoyList,
);

deliveryBoy.post(
  '/create',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.DELIVERY_BOY_MANAGE),
  validate({ body: schema.createDeliveryBoySchema }),
  controller.deliveryBoyCreate,
);

deliveryBoy.patch(
  '/update/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.DELIVERY_BOY_MANAGE),
  validate({ params: schema.deliveryBoyIdParamSchema, body: schema.updateDeliveryBoySchema }),
  controller.deliveryBoyUpdate,
);

deliveryBoy.delete(
  '/delete/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.DELIVERY_BOY_MANAGE),
  validate({ params: schema.deliveryBoyIdParamSchema }),
  controller.deliveryBoyDelete,
);

deliveryBoy.patch(
  '/toggleStatus/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.DELIVERY_BOY_MANAGE),
  validate({ params: schema.deliveryBoyIdParamSchema, body: schema.toggleDeliveryBoySchema }),
  controller.deliveryBoyToggle,
);

deliveryBoy.get(
  '/getMyDeliveries',
  authenticate,
  ...controller.guards.rider,
  validate({ query: schema.listDeliveryBoysSchema }),
  controller.deliveryList,
);

deliveryBoy.patch(
  '/updateDeliveryStatus/:id',
  authenticate,
  ...controller.guards.rider,
  validate({ params: idParamSchema, body: schema.shipmentStatusSchema }),
  controller.deliveryStatusUpdate,
);

export const deliveryBoyRoutes = deliveryBoy;

const settings = Router();

settings.get('/getPublicSettings', controller.settingsPublic);

settings.get(
  '/getAll',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SETTINGS_VIEW),
  validate({ query: schema.listSettingsSchema }),
  controller.settingsList,
);

settings.patch(
  '/updateSetting',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SETTINGS_UPDATE),
  validate({ body: schema.updateSettingSchema }),
  controller.settingsUpdate,
);

settings.post(
  '/bulkUpdateSettings',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SETTINGS_UPDATE),
  validate({ body: schema.bulkUpdateSettingsSchema }),
  controller.settingsBulkUpdate,
);

settings.get(
  '/getByCategory/:category',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SETTINGS_VIEW),
  validate({ params: schema.settingCategoryParamSchema }),
  controller.settingsByCategory,
);

settings.post(
  '/resetToDefault',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.SETTINGS_RESET),
  controller.settingsReset,
);

settings.get('/getFeatureFlags', controller.featureFlags);

settings.patch(
  '/toggleFeature',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.FEATURE_TOGGLE),
  validate({ body: schema.toggleFeatureSchema }),
  controller.featureToggle,
);

settings.get('/getMaintenance', controller.maintenanceStatus);

settings.patch(
  '/updateMaintenance',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.MAINTENANCE_TOGGLE),
  validate({ body: schema.updateMaintenanceSchema }),
  controller.maintenanceUpdate,
);

export const settingsRoutes = settings;

export default router;
