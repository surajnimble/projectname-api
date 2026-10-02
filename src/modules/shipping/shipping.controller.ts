import { Request } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { SUCCESS } from '../../messages/success';
import { asyncHandler } from '../../utils/asyncHandler';
import { D } from '../../utils/defaults';
import { getPagination } from '../../utils/pagination';
import { requireRole } from '../../middlewares/auth.middleware';
import * as service from './shipping.service';
import {
  serializeShippingZone,
  serializeShippingMethod,
  serializeShippingPartner,
  serializeDeliveryBoy,
  serializeDelivery,
  serializeShipment,
  serializeSystemSetting,
  serializeAuditLog,
  serializeActivityLog,
  serializeApiKey,
  serializeUser,
} from '../../utils/serialize';

const actorId = (req: Request): string => req.auth!.userId;

export const guards = {
  admin: [requireRole('SUPER_ADMIN', 'SUB_ADMIN')],
  superAdmin: [requireRole('SUPER_ADMIN')],
};

// ═══ Zones ═══════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /shipping/zones/getAll:
 *   get:
 *     tags: [Shipping]
 *     summary: List shipping zones with their methods
 *     responses:
 *       200: { description: Paginated zones }
 */
export const zoneList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listZones({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SHIPPING.ZONES_FETCHED,
    result: { itemList: rows.map(serializeShippingZone) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/**
 * @openapi
 * /shipping/zones/createZone:
 *   post:
 *     tags: [Shipping]
 *     summary: Create a shipping zone (admin)
 *     responses:
 *       201: { description: Zone created }
 */
export const zoneCreate = asyncHandler(async (req, res) => {
  const row = await service.createZone(req.body, req);
  return ApiResponse.created(res, SUCCESS.SHIPPING.ZONE_CREATED, serializeShippingZone(row));
});

/**
 * @openapi
 * /shipping/zones/updateZone/:id:
 *   patch:
 *     tags: [Shipping]
 *     summary: Update a shipping zone (admin)
 *     responses:
 *       200: { description: Zone updated }
 */
export const zoneUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateZone(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.ZONE_UPDATED, result: serializeShippingZone(row) });
});

/**
 * @openapi
 * /shipping/zones/deleteZone/:id:
 *   delete:
 *     tags: [Shipping]
 *     summary: Delete a zone; its methods are detached, not removed
 *     responses:
 *       200: { description: Zone deleted }
 */
export const zoneDelete = asyncHandler(async (req, res) => {
  await service.deleteZone(D.str(req.params.id), req);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.ZONE_DELETED, result: { id: D.str(req.params.id) } });
});

// ═══ Methods ═════════════════════════════════════════════════════════════════

/** GET /shipping/methods/getAll */
export const methodList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listMethods({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SHIPPING.METHODS_FETCHED,
    result: { itemList: rows.map(serializeShippingMethod) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** POST /shipping/methods/createMethod — admin */
export const methodCreate = asyncHandler(async (req, res) => {
  const row = await service.createMethod(req.body, req);
  return ApiResponse.created(res, SUCCESS.SHIPPING.METHOD_CREATED, serializeShippingMethod(row));
});

/** PATCH /shipping/methods/updateMethod/:id — admin */
export const methodUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateMethod(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.METHOD_UPDATED, result: serializeShippingMethod(row) });
});

/**
 * DELETE /shipping/methods/deleteMethod/:id — admin
 * A method that has shipped orders is deactivated rather than deleted.
 */
export const methodDelete = asyncHandler(async (req, res) => {
  await service.deleteMethod(D.str(req.params.id), req);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.METHOD_DELETED, result: { id: D.str(req.params.id) } });
});

// ═══ Partners ════════════════════════════════════════════════════════════════

/** GET /shipping/partners/getAll — the API key is never returned */
export const partnerList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listPartners({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SHIPPING.PARTNERS_FETCHED,
    result: { itemList: rows.map(serializeShippingPartner) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** POST /shipping/partners/createPartner — admin */
export const partnerCreate = asyncHandler(async (req, res) => {
  const row = await service.createPartner(req.body, req);
  return ApiResponse.created(res, SUCCESS.SHIPPING.PARTNER_CREATED, serializeShippingPartner(row));
});

/** PATCH /shipping/partners/updatePartner/:id — admin */
export const partnerUpdate = asyncHandler(async (req, res) => {
  const row = await service.updatePartner(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.PARTNER_CREATED, result: serializeShippingPartner(row) });
});

// ═══ Serviceability ═══════════════════════════════════════════════════════════

/**
 * @openapi
 * /shipping/checkServiceable:
 *   post:
 *     tags: [Shipping]
 *     summary: Is a pincode deliverable, and through which zone
 *     description: >
 *       Zones are matched pincode-first, then state, then country. With no zone
 *       match the global shipping settings decide.
 *     responses:
 *       200: { description: Serviceability plus the reason it resolved that way }
 */
export const checkServiceable = asyncHandler(async (req, res) => {
  const result = await service.checkServiceable(req.body);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.SERVICEABILITY_CHECKED, result });
});

/**
 * @openapi
 * /shipping/calculateRate:
 *   post:
 *     tags: [Shipping]
 *     summary: Quote a shipping rate for a destination
 *     responses:
 *       200: { description: Rate and estimated delivery window }
 */
export const calculateRate = asyncHandler(async (req, res) => {
  const result = await service.calculateRate(req.body);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.RATE_CALCULATED, result });
});

// ═══ Shipments ═══════════════════════════════════════════════════════════════

/**
 * @openapi
 * /shipping/shipments/updateStatus/:id:
 *   patch:
 *     tags: [Shipping]
 *     summary: Advance a shipment through its own state machine (admin)
 *     responses:
 *       200: { description: Shipment updated }
 *       422: { description: Transition not allowed }
 */
export const shipmentStatus = asyncHandler(async (req, res) => {
  const row = await service.updateShipmentStatus(D.str(req.params.id), D.str(req.body.status), D.str(req.body.remarks), req);
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.STATUS_UPDATED, result: serializeShipment(row) });
});

// ═══ Delivery boys ════════════════════════════════════════════════════════════

/**
 * @openapi
 * /shipping/delivery-boys/getAll:
 *   get:
 *     tags: [Delivery]
 *     summary: List riders
 *     description: "Sending `?availableOnly=true` filters to riders with spare capacity."
 *     responses:
 *       200: { description: Paginated riders }
 */
export const deliveryBoyList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listDeliveryBoys({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.DELIVERY_BOY.FETCHED,
    result: { itemList: rows.map(serializeDeliveryBoy) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** POST /shipping/delivery-boys/createDeliveryBoy — admin */
export const deliveryBoyCreate = asyncHandler(async (req, res) => {
  const row = await service.createDeliveryBoy(req.body, req);
  return ApiResponse.created(res, SUCCESS.DELIVERY_BOY.CREATED, serializeDeliveryBoy(row));
});

/** PATCH /shipping/delivery-boys/updateDeliveryBoy/:id — admin */
export const deliveryBoyUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateDeliveryBoy(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, { message: SUCCESS.DELIVERY_BOY.UPDATED, result: serializeDeliveryBoy(row) });
});

/**
 * PATCH /shipping/delivery-boys/toggleStatus/:id — admin
 * A rider with active deliveries cannot be deactivated.
 */
export const deliveryBoyToggle = asyncHandler(async (req, res) => {
  const row = await service.toggleDeliveryBoy(D.str(req.params.id), Boolean(req.body.isActive), req);
  return ApiResponse.success(res, { message: SUCCESS.DELIVERY_BOY.STATUS_UPDATED, result: serializeDeliveryBoy(row) });
});

/** DELETE /shipping/delivery-boys/deleteDeliveryBoy/:id — admin */
export const deliveryBoyDelete = asyncHandler(async (req, res) => {
  await service.deleteDeliveryBoy(D.str(req.params.id), req);
  return ApiResponse.success(res, { message: SUCCESS.DELIVERY_BOY.DELETED, result: { id: D.str(req.params.id) } });
});

/**
 * @openapi
 * /shipping/delivery-boys/getDeliveries:
 *   get:
 *     tags: [Delivery]
 *     summary: Delivery queue (a rider sees only their own)
 *     responses:
 *       200: { description: Paginated deliveries }
 */
export const deliveryList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const isRider = req.auth!.role === 'DELIVERY_BOY';

  const { rows, total } = await service.listDeliveries(
    { ...(req.query as any), skip, take },
    isRider ? req.auth!.userId : undefined,
  );

  return ApiResponse.paginated(res, {
    message: SUCCESS.DELIVERY_BOY.DELIVERIES_FETCHED,
    result: { itemList: rows.map(serializeDelivery) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

// ═══ Settings ════════════════════════════════════════════════════════════════

/** GET /settings/getAll — admin */
export const settingsList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listSettings({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SETTING.FETCHED,
    result: { itemList: rows.map(serializeSystemSetting) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /settings/getPublic — safe for any authenticated caller */
export const settingsPublic = asyncHandler(async (_req, res) => {
  const result = await service.getPublicSettings();
  return ApiResponse.success(res, { message: SUCCESS.SETTING.PUBLIC_FETCHED, result });
});

/** PATCH /settings/update — admin, one key */
export const settingsUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateSetting(req.body, actorId(req), req);
  return ApiResponse.success(res, { message: SUCCESS.SETTING.UPDATED, result: serializeSystemSetting(row) });
});

/** PATCH /settings/bulkUpdate — admin, atomic batch */
export const settingsBulkUpdate = asyncHandler(async (req, res) => {
  const count = await service.bulkUpdateSettings(req.body.settings, actorId(req), req);
  return ApiResponse.success(res, {
    message: SUCCESS.SETTING.BULK_UPDATED,
    result: { updatedCount: D.num(count) },
  });
});

// ═══ Admin ═══════════════════════════════════════════════════════════════════

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Headline counts across the platform (admin)
 *     responses:
 *       200: { description: Dashboard summary }
 */
export const dashboard = asyncHandler(async (_req, res) => {
  const result = await service.getDashboard();
  return ApiResponse.success(res, { message: SUCCESS.ADMIN.DASHBOARD_FETCHED, result });
});

/** POST /admin/sub-admins — super admin only */
export const subAdminCreate = asyncHandler(async (req, res) => {
  const row = await service.createSubAdmin(req.body, actorId(req), req);
  return ApiResponse.created(res, SUCCESS.ADMIN.SUB_ADMIN_CREATED, row);
});

/** GET /admin/sub-admins — admin */
export const subAdminList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listSubAdmins({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.SUB_ADMINS_FETCHED,
    result: { itemList: rows.map((u: any) => serializeUser(u)) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /admin/permissions/:role — admin */
export const permissionsGet = asyncHandler(async (req, res) => {
  const list = await service.listRolePermissions(D.str(req.params.role));

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.PERMISSIONS_FETCHED,
    result: { role: D.str(req.params.role), itemCount: list.length, permissionList: list },
  });
});

/** PATCH /admin/permissions/:role — admin, replaces the set */
export const permissionsSet = asyncHandler(async (req, res) => {
  const count = await service.setRolePermissions(D.str(req.params.role), req.body.permissions, actorId(req), req);

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.PERMISSIONS_UPDATED,
    result: { role: D.str(req.params.role), permissionCount: D.num(count) },
  });
});

/** GET /admin/audit-logs — admin */
export const auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listAuditLogs({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.AUDIT_LOGS_FETCHED,
    result: { itemList: rows.map(serializeAuditLog) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/** GET /admin/activity-logs — admin */
export const activityLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listActivityLogs({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.ACTIVITY_LOGS_FETCHED,
    result: { itemList: rows.map(serializeActivityLog) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/**
 * @openapi
 * /admin/health:
 *   get:
 *     tags: [Admin]
 *     summary: Database reachability and process stats (admin)
 *     responses:
 *       200: { description: Health report }
 */
export const health = asyncHandler(async (_req, res) => {
  const result = await service.getSystemHealth();
  return ApiResponse.success(res, { message: SUCCESS.ADMIN.HEALTH_FETCHED, result });
});

// ═══ API keys ═════════════════════════════════════════════════════════════════

/** GET /admin/api-keys — admin; secrets are never listed */
export const apiKeyList = asyncHandler(async (_req, res) => {
  const rows = await service.listApiKeys();

  return ApiResponse.success(res, {
    message: SUCCESS.API_KEY.FETCHED,
    result: { itemCount: rows.length, itemList: rows.map(serializeApiKey) },
  });
});

/**
 * POST /admin/api-keys — admin
 * The secret is returned exactly once; only a hash is stored.
 */
export const apiKeyCreate = asyncHandler(async (req, res) => {
  const row = await service.createApiKey(req.body, actorId(req), req);
  return ApiResponse.created(res, SUCCESS.API_KEY.CREATED, row);
});

/** POST /admin/api-keys/revoke/:id — admin */
export const apiKeyRevoke = asyncHandler(async (req, res) => {
  const row = await service.revokeApiKey(D.str(req.params.id), actorId(req), req);
  return ApiResponse.success(res, { message: SUCCESS.API_KEY.REVOKED, result: row });
});

/** DELETE /admin/api-keys/:id — admin */
export const apiKeyDelete = asyncHandler(async (req, res) => {
  await service.deleteApiKey(D.str(req.params.id), actorId(req), req);
  return ApiResponse.success(res, { message: SUCCESS.API_KEY.DELETED, result: { id: D.str(req.params.id) } });
});