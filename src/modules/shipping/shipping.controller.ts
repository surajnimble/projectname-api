import { Request } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { SUCCESS } from '../../messages/success';
import { ERROR } from '../../messages/error';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ROLES } from '../../constants/roles';
import { D } from '../../utils/defaults';
import { getPagination } from '../../utils/pagination';
import { requireRole } from '../../middlewares/auth.middleware';
import * as orderService from '../order/order.service';
import * as service from './shipping.service';
import { prisma } from '../../services/prisma.service';
import {
  serializeShippingZone,
  serializeShippingMethod,
  serializeShippingPartner,
  serializeDeliveryBoy,
  serializeDelivery,
  serializeShipment,
  serializeSystemSetting,
} from '../../utils/serialize';

const actorId = (req: Request): string => req.auth!.userId;

export const guards = {
  admin: [requireRole(ROLES.SUPER_ADMIN, ROLES.SUB_ADMIN)],
  superAdmin: [requireRole(ROLES.SUPER_ADMIN)],
  vendor: [requireRole(ROLES.VENDOR)],
  rider: [requireRole(ROLES.DELIVERY_BOY)],
};

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
    result: { shippingZoneList: rows.map(serializeShippingZone) },
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
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.ZONE_UPDATED,
    result: serializeShippingZone(row),
  });
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
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.ZONE_DELETED,
    result: { id: D.str(req.params.id) },
  });
});

/**
 * @openapi
 * /shipping/zones/toggleZone/:id:
 *   patch:
 *     tags: [Shipping]
 *     summary: Toggle a shipping zone active/inactive (admin)
 *     responses:
 *       200: { description: Zone toggled }
 */
export const zoneToggle = asyncHandler(async (req, res) => {
  const row = await service.toggleZone(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.ZONE_TOGGLED,
    result: serializeShippingZone(row),
  });
});

export const methodList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listMethods({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SHIPPING.METHODS_FETCHED,
    result: { shippingMethodList: rows.map(serializeShippingMethod) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const methodCreate = asyncHandler(async (req, res) => {
  const row = await service.createMethod(req.body, req);
  return ApiResponse.created(res, SUCCESS.SHIPPING.METHOD_CREATED, serializeShippingMethod(row));
});

export const methodUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateMethod(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.METHOD_UPDATED,
    result: serializeShippingMethod(row),
  });
});

export const methodDelete = asyncHandler(async (req, res) => {
  await service.deleteMethod(D.str(req.params.id), req);
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.METHOD_DELETED,
    result: { id: D.str(req.params.id) },
  });
});

export const partnerList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listPartners({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SHIPPING.PARTNERS_FETCHED,
    result: { shippingPartnerList: rows.map(serializeShippingPartner) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const partnerCreate = asyncHandler(async (req, res) => {
  const row = await service.createPartner(req.body, req);
  return ApiResponse.created(res, SUCCESS.SHIPPING.PARTNER_CREATED, serializeShippingPartner(row));
});

export const partnerUpdate = asyncHandler(async (req, res) => {
  const row = await service.updatePartner(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.PARTNER_UPDATED,
    result: serializeShippingPartner(row),
  });
});

export const partnerDelete = asyncHandler(async (req, res) => {
  const partner = await service.deletePartner(D.str(req.params.id), req);
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.PARTNER_DELETED,
    result: { partnerId: partner.id, name: partner.name, isDeleted: true },
  });
});

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
  const row = await service.updateShipmentStatus(
    D.str(req.params.id),
    D.str(req.body.status),
    D.str(req.body.remarks),
    req,
  );
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.STATUS_UPDATED,
    result: serializeShipment(row),
  });
});

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
    result: { deliveryBoyList: rows.map(serializeDeliveryBoy) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const deliveryBoyCreate = asyncHandler(async (req, res) => {
  const row = await service.createDeliveryBoy(req.body, req);
  return ApiResponse.created(res, SUCCESS.DELIVERY_BOY.CREATED, serializeDeliveryBoy(row));
});

export const deliveryBoyUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateDeliveryBoy(D.str(req.params.id), req.body, req);
  return ApiResponse.success(res, {
    message: SUCCESS.DELIVERY_BOY.UPDATED,
    result: serializeDeliveryBoy(row),
  });
});

export const deliveryBoyToggle = asyncHandler(async (req, res) => {
  const row = await service.toggleDeliveryBoy(
    D.str(req.params.id),
    Boolean(req.body.isActive),
    req,
  );
  return ApiResponse.success(res, {
    message: SUCCESS.DELIVERY_BOY.STATUS_UPDATED,
    result: serializeDeliveryBoy(row),
  });
});

export const deliveryBoyDelete = asyncHandler(async (req, res) => {
  await service.deleteDeliveryBoy(D.str(req.params.id), req);
  return ApiResponse.success(res, {
    message: SUCCESS.DELIVERY_BOY.DELETED,
    result: { id: D.str(req.params.id) },
  });
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
  const { rows, total } = await service.listDeliveries(
    { ...(req.query as any), skip, take },
    req.auth!.userId,
  );

  return ApiResponse.paginated(res, {
    message: SUCCESS.DELIVERY_BOY.DELIVERIES_FETCHED,
    result: { deliveryList: rows.map(serializeDelivery) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const settingsList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listSettings({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.SETTING.FETCHED,
    result: { systemSettingList: rows.map(serializeSystemSetting) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const settingsPublic = asyncHandler(async (_req, res) => {
  const result = await service.getPublicSettings();
  return ApiResponse.success(res, { message: SUCCESS.SETTING.PUBLIC_FETCHED, result });
});

export const settingsUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateSetting(req.body, actorId(req), req);
  return ApiResponse.success(res, {
    message: SUCCESS.SETTING.UPDATED,
    result: serializeSystemSetting(row),
  });
});

export const settingsBulkUpdate = asyncHandler(async (req, res) => {
  const count = await service.bulkUpdateSettings(req.body.settings, actorId(req), req);
  return ApiResponse.success(res, {
    message: SUCCESS.SETTING.BULK_UPDATED,
    result: { updatedCount: D.num(count) },
  });
});

export const shipmentCreate = asyncHandler(async (req, res) => {
  const row = await service.createShipment(
    D.str(req.params.subOrderId),
    req.auth!.vendorId,
    req.body,
    actorId(req),
    req,
  );

  return ApiResponse.created(res, SUCCESS.SHIPPING.SHIPMENT_CREATED, serializeShipment(row));
});

export const shipmentTrack = asyncHandler(async (req, res) => {
  const result = await service.trackShipment(D.str(req.params.awb));
  return ApiResponse.success(res, { message: SUCCESS.SHIPPING.TRACKED, result });
});

export const deliveryStatusUpdate = asyncHandler(async (req, res) => {
  const deliveryId = D.str(req.params.id);
  const status = D.str(req.body.status).toUpperCase();

  if (status === 'DELIVERED') {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { id: true, subOrderId: true },
    });
    if (!delivery) throw AppError.notFound(ERROR.SHIPPING.SHIPMENT_NOT_FOUND);

    await orderService.confirmDelivery(
      delivery.subOrderId,
      {
        otp: D.str(req.body.otp),
        remarks: D.str(req.body.remarks),
        ...(req.body.collectedAmount === undefined
          ? {}
          : { collectedAmount: D.num(req.body.collectedAmount) }),
      },
      req.auth!.userId,
      req,
    );

    const verifiedDelivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        deliveryBoy: { select: { id: true, name: true, phone: true, vehicleNo: true } },
        subOrder: {
          select: {
            id: true,
            status: true,
            trackingNumber: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                address: { select: { fullName: true, phone: true, line1: true, city: true, pincode: true } },
              },
            },
          },
        },
      },
    });

    return ApiResponse.success(res, {
      message: SUCCESS.SHIPPING.DELIVERY_STATUS_UPDATED,
      result: serializeDelivery(verifiedDelivery),
    });
  }

  const row = await service.updateDeliveryStatus(deliveryId, req.body, req.auth!.userId, req);
  return ApiResponse.success(res, {
    message: SUCCESS.SHIPPING.DELIVERY_STATUS_UPDATED,
    result: serializeDelivery(row),
  });
});

export const settingsByCategory = asyncHandler(async (req, res) => {
  const category = D.str(req.params.category);
  const result = await service.getSettingsByCategory(category);

  return ApiResponse.success(res, {
    message: SUCCESS.SETTING.CATEGORY_FETCHED,
    result: { category, settingList: result },
  });
});

export const settingsReset = asyncHandler(async (req, res) => {
  const result = await service.resetSettings(actorId(req), req);
  return ApiResponse.success(res, { message: SUCCESS.SETTING.RESET, result });
});

export const featureFlags = asyncHandler(async (_req, res) => {
  const result = await service.getFeatureFlagMap();
  return ApiResponse.success(res, { message: SUCCESS.SETTING.FEATURE_FLAGS_FETCHED, result });
});

export const featureToggle = asyncHandler(async (req, res) => {
  const enabled = await service.toggleFeatureFlag(
    D.str(req.body.key),
    Boolean(req.body.enabled),
    actorId(req),
  );

  return ApiResponse.success(res, {
    message: SUCCESS.SETTING.FEATURE_TOGGLED,
    result: { key: D.str(req.body.key), isEnabled: D.bool(enabled) },
  });
});

export const maintenanceStatus = asyncHandler(async (_req, res) => {
  const result = await service.getMaintenanceMode();
  return ApiResponse.success(res, { message: SUCCESS.SETTING.MAINTENANCE_FETCHED, result });
});

export const maintenanceUpdate = asyncHandler(async (req, res) => {
  const result = await service.setMaintenanceMode(req.body, actorId(req), req);
  return ApiResponse.success(res, { message: SUCCESS.SETTING.MAINTENANCE_UPDATED, result });
});
