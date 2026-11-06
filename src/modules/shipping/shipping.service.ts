import { Prisma } from '@prisma/client';
import { ROLES } from '../../constants/roles';
import { SHIPMENT_STATUS_TRANSITIONS } from '../../constants/statuses';
import { COUNTRIES } from '../../constants/countries';
import { prisma } from '../../services/prisma.service';
import { AppError } from '../../utils/AppError';
import { D, money } from '../../utils/defaults';
import { ERROR } from '../../messages/error';
import { ERROR_CODE } from '../../constants/http';
import { generateAwb } from '../../utils/slug';
import { writeActivityLog, writeAuditLog } from '../../services/audit.service';
import {
  getFeatureFlags,
  toggleFeature,
  getMaintenanceStatus,
  getSettingByCategory,
  getShippingConfig,
  resetSettingsToDefault,
  setSetting,
} from '../../services/settings.service';
import { SETTING_CATEGORY, SETTING_KEY } from '../../config/setting.config';
import { SETTINGS } from '../../config/setting-defaults';

export const getFeatureFlagMap = getFeatureFlags;

export const toggleFeatureFlag = toggleFeature;

export const getMaintenanceMode = getMaintenanceStatus;

const ZONE_INCLUDE = { methods: { orderBy: { name: 'asc' } } } satisfies Prisma.ShippingZoneInclude;

export const listZones = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.ShippingZoneWhereInput = {};

  if (D.str(query.isActive) === 'true') where.isActive = true;
  if (D.str(query.isActive) === 'false') where.isActive = false;

  const [rows, total] = await Promise.all([
    prisma.shippingZone.findMany({
      where,
      include: ZONE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.shippingZone.count({ where }),
  ]);

  return { rows, total };
};

export const createZone = async (input: Record<string, any>, req?: any): Promise<any> => {
  const row = await prisma.shippingZone.create({
    data: {
      name: D.str(input.name),
      countries: D.strArr(input.countries).map((c) => resolveCountryCode(c) || c.toUpperCase()),
      states: D.strArr(input.states),
      pincodes: D.strArr(input.pincodes),
      isActive: input.isActive !== false,
    },
    include: ZONE_INCLUDE,
  });

  void writeAuditLog({
    req,
    action: 'CREATE',
    entity: 'ShippingZone',
    entityId: row.id,
    description: row.name,
  });

  return row;
};

export const updateZone = async (
  zoneId: string,
  input: Record<string, any>,
  req?: any,
): Promise<any> => {
  const existing = await prisma.shippingZone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.ZONE_NOT_FOUND);

  const row = await prisma.shippingZone.update({
    where: { id: zoneId },
    data: {
      ...(input.name === undefined ? {} : { name: D.str(input.name) }),
      ...(input.countries === undefined
        ? {}
        : {
            countries: D.strArr(input.countries).map(
              (c) => resolveCountryCode(c) || c.toUpperCase(),
            ),
          }),
      ...(input.states === undefined ? {} : { states: D.strArr(input.states) }),
      ...(input.pincodes === undefined ? {} : { pincodes: D.strArr(input.pincodes) }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
    include: ZONE_INCLUDE,
  });

  void writeAuditLog({
    req,
    action: 'UPDATE',
    entity: 'ShippingZone',
    entityId: zoneId,
    description: existing.name,
  });

  return row;
};

export const deleteZone = async (zoneId: string, req?: any): Promise<void> => {
  const existing = await prisma.shippingZone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.ZONE_NOT_FOUND);

  await prisma.shippingZone.delete({ where: { id: zoneId } });

  void writeAuditLog({
    req,
    action: 'DELETE',
    entity: 'ShippingZone',
    entityId: zoneId,
    description: existing.name,
  });
};

export const toggleZone = async (
  zoneId: string,
  input: Record<string, any>,
  req?: any,
): Promise<any> => {
  const existing = await prisma.shippingZone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true, isActive: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.ZONE_NOT_FOUND);

  const isActive = input.isActive !== undefined ? input.isActive : !existing.isActive;

  const row = await prisma.shippingZone.update({
    where: { id: zoneId },
    data: { isActive },
    include: ZONE_INCLUDE,
  });

  void writeAuditLog({
    req,
    action: isActive ? 'ACTIVATE' : 'SUSPEND',
    entity: 'ShippingZone',
    entityId: zoneId,
    description: existing.name,
  });

  return row;
};

export const listMethods = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.ShippingMethodWhereInput = {};

  if (D.str(query.zoneId)) where.zoneId = D.str(query.zoneId);
  if (D.str(query.isActive) === 'true') where.isActive = true;
  if (D.str(query.isActive) === 'false') where.isActive = false;

  const [rows, total] = await Promise.all([
    prisma.shippingMethod.findMany({
      where,
      include: { zone: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.shippingMethod.count({ where }),
  ]);

  return { rows, total };
};

export const createMethod = async (input: Record<string, any>, req?: any): Promise<any> => {
  const code = D.str(input.code).toUpperCase();

  const existing = await prisma.shippingMethod.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict(ERROR.SHIPPING.METHOD_CODE_EXISTS, ERROR_CODE.DUPLICATE);
  }

  if (D.num(input.maxDays) < D.num(input.minDays)) {
    throw AppError.unprocessable(ERROR.SHIPPING.DELIVERY_WINDOW_INVALID);
  }

  if (D.str(input.zoneId)) {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: D.str(input.zoneId) },
      select: { id: true },
    });
    if (!zone) throw AppError.notFound(ERROR.SHIPPING.ZONE_NOT_FOUND);
  }

  const row = await prisma.shippingMethod.create({
    data: {
      zoneId: D.str(input.zoneId) || null,
      name: D.str(input.name),
      code,
      description: D.str(input.description),
      baseCharge: D.float(input.baseCharge),
      perKgCharge: D.float(input.perKgCharge),
      freeAbove: D.float(input.freeAbove),
      minDays: D.num(input.minDays) || 1,
      maxDays: D.num(input.maxDays) || 7,
      isCodAllowed: input.isCodAllowed !== false,
      isActive: input.isActive !== false,
    },
    include: { zone: { select: { id: true, name: true } } },
  });

  void writeAuditLog({
    req,
    action: 'CREATE',
    entity: 'ShippingMethod',
    entityId: row.id,
    description: row.name,
  });

  return row;
};

export const updateMethod = async (
  methodId: string,
  input: Record<string, any>,
  req?: any,
): Promise<any> => {
  const existing = await prisma.shippingMethod.findUnique({
    where: { id: methodId },
    select: { id: true, name: true, minDays: true, maxDays: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.METHOD_NOT_FOUND);

  const nextMin = input.minDays === undefined ? D.num(existing.minDays) : D.num(input.minDays);
  const nextMax = input.maxDays === undefined ? D.num(existing.maxDays) : D.num(input.maxDays);

  if (nextMax < nextMin) {
    throw AppError.unprocessable(ERROR.SHIPPING.DELIVERY_WINDOW_INVALID);
  }

  const row = await prisma.shippingMethod.update({
    where: { id: methodId },
    data: {
      ...(input.zoneId === undefined ? {} : { zoneId: D.str(input.zoneId) || null }),
      ...(input.name === undefined ? {} : { name: D.str(input.name) }),
      ...(input.description === undefined ? {} : { description: D.str(input.description) }),
      ...(input.baseCharge === undefined ? {} : { baseCharge: D.float(input.baseCharge) }),
      ...(input.perKgCharge === undefined ? {} : { perKgCharge: D.float(input.perKgCharge) }),
      ...(input.freeAbove === undefined ? {} : { freeAbove: D.float(input.freeAbove) }),
      ...(input.minDays === undefined ? {} : { minDays: D.num(input.minDays) }),
      ...(input.maxDays === undefined ? {} : { maxDays: D.num(input.maxDays) }),
      ...(input.isCodAllowed === undefined ? {} : { isCodAllowed: input.isCodAllowed }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
    include: { zone: { select: { id: true, name: true } } },
  });

  void writeAuditLog({
    req,
    action: 'UPDATE',
    entity: 'ShippingMethod',
    entityId: methodId,
    description: existing.name,
  });

  return row;
};

export const deleteMethod = async (methodId: string, req?: any): Promise<void> => {
  const existing = await prisma.shippingMethod.findUnique({
    where: { id: methodId },
    select: { id: true, name: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.METHOD_NOT_FOUND);

  const used = await prisma.shipment.count({ where: { methodId } });

  if (used > 0) {
    await prisma.shippingMethod.update({ where: { id: methodId }, data: { isActive: false } });

    void writeAuditLog({
      req,
      action: 'TOGGLE',
      entity: 'ShippingMethod',
      entityId: methodId,
      description: `${existing.name} deactivated (${used} shipments)`,
    });

    return;
  }

  await prisma.shippingMethod.delete({ where: { id: methodId } });

  void writeAuditLog({
    req,
    action: 'DELETE',
    entity: 'ShippingMethod',
    entityId: methodId,
    description: existing.name,
  });
};

export const listPartners = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.ShippingPartnerWhereInput = {};

  if (D.str(query.isActive) === 'true') where.isActive = true;
  if (D.str(query.isActive) === 'false') where.isActive = false;

  const [rows, total] = await Promise.all([
    prisma.shippingPartner.findMany({
      where,

      select: { id: true, name: true, code: true, apiUrl: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.shippingPartner.count({ where }),
  ]);

  return { rows, total };
};

export const createPartner = async (input: Record<string, any>, req?: any): Promise<any> => {
  const code = D.str(input.code).toUpperCase();

  const existing = await prisma.shippingPartner.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict(ERROR.SHIPPING.PARTNER_CODE_EXISTS, ERROR_CODE.DUPLICATE);
  }

  const row = await prisma.shippingPartner.create({
    data: {
      name: D.str(input.name),
      code,
      apiUrl: D.str(input.apiUrl),
      apiKey: D.str(input.apiKey),
      isActive: input.isActive !== false,
    },
    select: { id: true, name: true, code: true, apiUrl: true, isActive: true, createdAt: true },
  });

  void writeAuditLog({
    req,
    action: 'CREATE',
    entity: 'ShippingPartner',
    entityId: row.id,
    description: row.name,
  });

  return row;
};

export const updatePartner = async (
  partnerId: string,
  input: Record<string, any>,
  req?: any,
): Promise<any> => {
  const existing = await prisma.shippingPartner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true, code: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.PARTNER_NOT_FOUND);

  if (D.str(input.code) && D.str(input.code).toUpperCase() !== existing.code.toUpperCase()) {
    const clash = await prisma.shippingPartner.findFirst({
      where: { code: D.str(input.code).toUpperCase(), id: { not: partnerId } },
      select: { id: true },
    });

    if (clash) throw AppError.conflict(ERROR.SHIPPING.PARTNER_CODE_EXISTS, ERROR_CODE.DUPLICATE);
  }

  const row = await prisma.shippingPartner.update({
    where: { id: partnerId },
    data: {
      ...(input.name === undefined ? {} : { name: D.str(input.name) }),
      ...(input.code === undefined ? {} : { code: D.str(input.code).toUpperCase() }),
      ...(input.apiUrl === undefined ? {} : { apiUrl: D.str(input.apiUrl) }),
      ...(input.apiKey === undefined ? {} : { apiKey: D.str(input.apiKey) }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    },
    select: { id: true, name: true, code: true, apiUrl: true, isActive: true, createdAt: true },
  });

  void writeAuditLog({ req, action: 'UPDATE', entity: 'ShippingPartner', entityId: partnerId });

  return row;
};

export const deletePartner = async (partnerId: string, req?: any): Promise<{ id: string; name: string }> => {
  const existing = await prisma.shippingPartner.findUnique({
    where: { id: partnerId },
    select: { id: true, name: true },
  });

  if (!existing) throw AppError.notFound(ERROR.SHIPPING.PARTNER_NOT_FOUND);

  // Shipment.partner uses onDelete: SetNull, preserving shipment history when a carrier is removed.
  await prisma.shippingPartner.delete({ where: { id: partnerId } });

  void writeAuditLog({
    req,
    action: 'DELETE',
    entity: 'ShippingPartner',
    entityId: partnerId,
    description: `Shipping partner deleted: ${existing.name}`,
  });

  return existing;
};

const resolveZone = async (
  pincode: string,
  country?: string,
  state?: string,
): Promise<{ zone: any | null; reason: string }> => {
  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: ZONE_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });

  for (const zone of zones) {
    if (D.strArr(zone.pincodes).length && D.strArr(zone.pincodes).includes(pincode)) {
      return { zone, reason: 'matched by pincode' };
    }
  }

  for (const zone of zones) {
    if (
      D.str(state) &&
      D.strArr(zone.states).length &&
      D.strArr(zone.states).some((s) => D.str(s).toLowerCase() === D.str(state).toLowerCase())
    ) {
      return { zone, reason: 'matched by state' };
    }
  }

  const countryCode = resolveCountryCode(country);

  if (countryCode) {
    for (const zone of zones) {
      if (D.strArr(zone.countries).some((c) => D.str(c).toUpperCase() === countryCode)) {
        return { zone, reason: 'matched by country' };
      }
    }
  }

  return { zone: null, reason: 'no zone matched' };
};

const resolveCountryCode = (country?: string): string => {
  const value = D.str(country).trim();
  if (!value) return '';

  const upper = value.toUpperCase();

  if (COUNTRIES.some((c) => c.code === upper)) return upper;

  const byName = COUNTRIES.find((c) => c.name.toUpperCase() === upper);
  return byName ? byName.code : '';
};

export const checkServiceable = async (input: {
  pincode: string;
  country?: string;
  state?: string;
}): Promise<Record<string, any>> => {
  const pincode = D.str(input.pincode);
  const { zone, reason } = await resolveZone(pincode, input.country, input.state);

  if (zone) {
    const methods = D.arr(zone.methods).filter((m: any) => D.bool(m.isActive));

    return {
      pincode,
      isServiceable: methods.length > 0,
      zoneId: D.str(zone.id),
      zoneName: D.str(zone.name),
      matchedBy: reason,
      methodCount: methods.length,
      estimatedDays: methods.length ? Math.min(...methods.map((m: any) => D.num(m.minDays))) : 0,
    };
  }

  const cfg = await getShippingConfig();

  if (!cfg.enabled) {
    return {
      pincode,
      isServiceable: false,
      zoneId: '',
      zoneName: '',
      matchedBy: 'shipping is disabled',
      methodCount: 0,
      estimatedDays: 0,
    };
  }

  const serviceablePincodes = D.arr(cfg.serviceablePincodes);
  const serviceable = serviceablePincodes.length === 0 || serviceablePincodes.includes(pincode);

  return {
    pincode,
    isServiceable: serviceable,
    zoneId: '',
    zoneName: '',
    matchedBy: serviceablePincodes.length
      ? 'global serviceable pincode list'
      : 'global fallback (no pincode list)',
    methodCount: serviceable ? 1 : 0,
    estimatedDays: serviceable ? D.num(cfg.estimatedDays) : 0,
  };
};

export const calculateRate = async (input: {
  pincode: string;
  weightKg?: number;
  orderValue?: number;
  methodId?: string;
}): Promise<Record<string, any>> => {
  const pincode = D.str(input.pincode);
  const weight = D.num(input.weightKg) || 0.5;
  const orderValue = D.num(input.orderValue);

  const { zone, reason } = await resolveZone(pincode);

  let method: any = null;

  if (D.str(input.methodId)) {
    method = await prisma.shippingMethod.findFirst({
      where: { id: D.str(input.methodId), isActive: true },
    });

    if (!method) throw AppError.notFound(ERROR.SHIPPING.METHOD_NOT_FOUND);
  } else if (zone) {
    const candidates = D.arr(zone.methods).filter((m: any) => D.bool(m.isActive));
    method =
      candidates.sort((a: any, b: any) => D.float(a.baseCharge) - D.float(b.baseCharge))[0] ?? null;
  }

  if (!method) {
    const cfg = await getShippingConfig();

    if (!cfg.enabled) {
      throw AppError.unprocessable(ERROR.SHIPPING.NOT_SERVICEABLE);
    }

    let charge = D.float(cfg.defaultCharge);
    if (cfg.perKgCharge > 0 && weight > 0) charge = money(charge + cfg.perKgCharge * weight);

    const free = cfg.freeAbove > 0 && orderValue >= cfg.freeAbove;

    return {
      pincode,
      methodId: '',
      methodName: 'Standard',
      methodCode: 'STANDARD',
      baseCharge: D.float(cfg.defaultCharge),
      perKgCharge: D.float(cfg.perKgCharge),
      weightKg: weight,
      charge: free ? 0 : charge,
      isFree: free,
      freeAbove: D.float(cfg.freeAbove),
      estimatedDays: D.num(cfg.estimatedDays),
      codAllowed: true,
      matchedBy: reason,
      zoneId: '',
      zoneName: '',
    };
  }

  let charge = money(D.float(method.baseCharge) + D.float(method.perKgCharge) * weight);
  const free = D.float(method.freeAbove) > 0 && orderValue >= D.float(method.freeAbove);

  if (free) charge = 0;

  return {
    pincode,
    methodId: D.str(method.id),
    methodName: D.str(method.name),
    methodCode: D.str(method.code),
    baseCharge: D.float(method.baseCharge),
    perKgCharge: D.float(method.perKgCharge),
    weightKg: weight,
    charge,
    isFree: free,
    freeAbove: D.float(method.freeAbove),
    estimatedDays: D.num(method.minDays),
    maxDays: D.num(method.maxDays),
    codAllowed: D.bool(method.isCodAllowed),
    matchedBy: D.str(input.methodId) ? 'requested method' : reason,
    zoneId: D.str(zone?.id),
    zoneName: D.str(zone?.name),
  };
};

const BOY_INCLUDE = {
  user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
} satisfies Prisma.DeliveryBoyInclude;

export const listDeliveryBoys = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.DeliveryBoyWhereInput = {};

  if (D.str(query.isActive) === 'true') where.isActive = true;
  if (D.str(query.isActive) === 'false') where.isActive = false;
  if (D.str(query.zoneId)) where.zoneId = D.str(query.zoneId);

  if (D.str(query.availableOnly) === 'true') where.currentLoad = { lt: 5 };

  if (D.str(query.search)) {
    const term = D.str(query.search);
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.deliveryBoy.findMany({
      where,
      include: BOY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.deliveryBoy.count({ where }),
  ]);

  return { rows, total };
};

export const createDeliveryBoy = async (input: Record<string, any>, req?: any): Promise<any> => {
  const user = await prisma.user.findUnique({
    where: { id: D.str(input.userId) },
    select: { id: true, role: true, isActive: true },
  });

  if (!user) throw AppError.notFound(ERROR.USER.NOT_FOUND);
  if (user.role !== 'DELIVERY_BOY' || !user.isActive) {
    throw AppError.unprocessable(ERROR.COMMON.FORBIDDEN, ERROR_CODE.FORBIDDEN);
  }

  const existing = await prisma.deliveryBoy.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict(ERROR.DELIVERY_BOY.ALREADY_EXISTS, ERROR_CODE.DUPLICATE);
  }

  if (D.str(input.zoneId)) {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: D.str(input.zoneId) },
      select: { id: true },
    });
    if (!zone) throw AppError.notFound(ERROR.SHIPPING.ZONE_NOT_FOUND);
  }

  const row = await prisma.deliveryBoy.create({
    data: {
      userId: user.id,
      name: D.str(input.name),
      phone: D.str(input.phone),
      email: D.str(input.email),
      vehicleType: D.str(input.vehicleType) || 'BIKE',
      vehicleNo: D.str(input.vehicleNo),
      zoneId: D.str(input.zoneId) || null,
      isActive: true,
    },
    include: BOY_INCLUDE,
  });

  void writeAuditLog({
    req,
    action: 'CREATE',
    entity: 'DeliveryBoy',
    entityId: row.id,
    description: row.name,
  });

  return row;
};

export const updateDeliveryBoy = async (
  boyId: string,
  input: Record<string, any>,
  req?: any,
): Promise<any> => {
  const existing = await prisma.deliveryBoy.findUnique({
    where: { id: boyId },
    select: { id: true, name: true },
  });

  if (!existing) throw AppError.notFound(ERROR.DELIVERY_BOY.NOT_FOUND);

  const row = await prisma.deliveryBoy.update({
    where: { id: boyId },
    data: {
      ...(input.name === undefined ? {} : { name: D.str(input.name) }),
      ...(input.phone === undefined ? {} : { phone: D.str(input.phone) }),
      ...(input.email === undefined ? {} : { email: D.str(input.email) }),
      ...(input.vehicleType === undefined ? {} : { vehicleType: D.str(input.vehicleType) }),
      ...(input.vehicleNo === undefined ? {} : { vehicleNo: D.str(input.vehicleNo) }),
      ...(input.zoneId === undefined ? {} : { zoneId: D.str(input.zoneId) || null }),
    },
    include: BOY_INCLUDE,
  });

  void writeAuditLog({
    req,
    action: 'UPDATE',
    entity: 'DeliveryBoy',
    entityId: boyId,
    description: existing.name,
  });

  return row;
};

export const toggleDeliveryBoy = async (
  boyId: string,
  isActive: boolean,
  req?: any,
): Promise<any> => {
  const existing = await prisma.deliveryBoy.findUnique({
    where: { id: boyId },
    select: { id: true, name: true },
  });

  if (!existing) throw AppError.notFound(ERROR.DELIVERY_BOY.NOT_FOUND);

  if (!isActive && existing.name) {
    const active = await prisma.delivery.count({
      where: { deliveryBoyId: boyId, status: { notIn: ['DELIVERED', 'FAILED', 'RETURNED'] } },
    });

    if (active > 0) {
      throw AppError.unprocessable(ERROR.DELIVERY_BOY.HAS_ACTIVE_DELIVERIES);
    }
  }

  const row = await prisma.deliveryBoy.update({
    where: { id: boyId },
    data: { isActive },
    include: BOY_INCLUDE,
  });

  void writeAuditLog({
    req,
    action: isActive ? 'ACTIVATE' : 'SUSPEND',
    entity: 'DeliveryBoy',
    entityId: boyId,
    description: existing.name,
  });

  return row;
};

export const deleteDeliveryBoy = async (boyId: string, req?: any): Promise<void> => {
  const existing = await prisma.deliveryBoy.findUnique({
    where: { id: boyId },
    select: { id: true, name: true, currentLoad: true },
  });

  if (!existing) throw AppError.notFound(ERROR.DELIVERY_BOY.NOT_FOUND);

  if (existing.currentLoad > 0) {
    throw AppError.unprocessable(ERROR.DELIVERY_BOY.HAS_UNDELIVERED_PARCELS);
  }

  await prisma.deliveryBoy.delete({ where: { id: boyId } });

  void writeAuditLog({
    req,
    action: 'DELETE',
    entity: 'DeliveryBoy',
    entityId: boyId,
    description: existing.name,
  });
};

export const listDeliveries = async (
  query: Record<string, any>,
  deliveryBoyUserId?: string,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.DeliveryWhereInput = {};

  if (deliveryBoyUserId) {
    const rider = await prisma.deliveryBoy.findUnique({
      where: { userId: deliveryBoyUserId },
      select: { id: true, isActive: true },
    });
    if (!rider || !rider.isActive) {
      return { rows: [], total: 0 };
    }
    where.deliveryBoyId = rider.id;
  }
  if (D.str(query.status)) where.status = query.status as any;
  if (D.str(query.subOrderId)) where.subOrderId = D.str(query.subOrderId);

  const [rows, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
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
                address: {
                  select: { fullName: true, phone: true, line1: true, city: true, pincode: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.delivery.count({ where }),
  ]);

  return { rows, total };
};

export const updateShipmentStatus = async (
  shipmentId: string,
  status: string,
  remarks?: string,
  req?: any,
): Promise<any> => {
  if (D.str(status).toUpperCase() === 'DELIVERED') {
    throw AppError.badRequest('Use delivery OTP verification to complete a delivery.');
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, status: true, subOrderId: true, awb: true },
  });

  if (!shipment) throw AppError.notFound(ERROR.SHIPPING.SHIPMENT_NOT_FOUND);

  const allowed = SHIPMENT_STATUS_TRANSITIONS[shipment.status] ?? [];

  if (!allowed.includes(status)) {
    throw AppError.unprocessable(
      `${ERROR.ORDER.INVALID_STATUS_TRANSITION} (${shipment.status} -> ${status})`,
      ERROR_CODE.INVALID_STATUS_TRANSITION,
    );
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        status: status as any,
        remarks: D.str(remarks) || shipment.status,
        ...(status === 'PICKED_UP' ? { shippedAt: new Date() } : {}),
        ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
      include: { method: true, partner: true, deliveries: true },
    });

    await tx.delivery.updateMany({
      where: { shipmentId },
      data: {
        status: status as any,
        ...(status === 'FAILED' || status === 'RETURNED'
          ? { deliveryOtp: '', deliveryOtpExpiresAt: null }
          : {}),
      },
    });

    return updated;
  });

  void writeAuditLog({
    req,
    action: 'UPDATE',
    entity: 'Shipment',
    entityId: shipmentId,
    description: `${shipment.awb}: ${shipment.status} -> ${status}`,
  });

  return row;
};

export const listSettings = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.SystemSettingWhereInput = {};

  if (D.str(query.category)) where.category = D.str(query.category);
  if (D.str(query.isPublic) === 'true') where.isPublic = true;
  if (D.str(query.isPublic) === 'false') where.isPublic = false;

  const [rows, total] = await Promise.all([
    prisma.systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.systemSetting.count({ where }),
  ]);

  return { rows, total };
};

export const getPublicSettings = async (): Promise<Record<string, any>> => {
  const rows = await prisma.systemSetting.findMany({ where: { isPublic: true } });

  const out: Record<string, any> = {};
  for (const row of rows) out[D.str(row.key)] = row.value;

  return out;
};

export const updateSetting = async (
  input: { key: string; value: any; category?: string; isPublic?: boolean },
  actorId?: string,
  req?: any,
): Promise<any> => {
  const key = D.str(input.key);

  const before = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true, category: true },
  });

  const row = await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: input.value as any,
      category: D.str(input.category) || before?.category || 'general',
      isPublic: input.isPublic ?? false,
      updatedBy: D.str(actorId) || null,
    },
    update: {
      value: input.value as any,
      ...(input.category === undefined ? {} : { category: D.str(input.category) }),
      ...(input.isPublic === undefined ? {} : { isPublic: input.isPublic }),
      updatedBy: D.str(actorId) || null,
    },
  });

  void writeAuditLog({
    req,
    actorId,
    action: 'UPDATE',
    entity: 'SystemSetting',
    entityId: key,
    description: `${key} changed`,
    changes: { from: before?.value ?? null, to: input.value ?? null },
  });

  return row;
};

export const bulkUpdateSettings = async (
  settings: { key: string; value: any; category?: string; isPublic?: boolean }[],
  actorId?: string,
  req?: any,
): Promise<number> => {
  const count = await prisma.$transaction(async (tx) => {
    for (const s of settings) {
      const key = D.str(s.key);
      const existing = await tx.systemSetting.findUnique({
        where: { key },
        select: { category: true },
      });

      await tx.systemSetting.upsert({
        where: { key },
        create: {
          key,
          value: s.value as any,
          category: D.str(s.category) || existing?.category || 'general',
          isPublic: s.isPublic ?? false,
          updatedBy: D.str(actorId) || null,
        },
        update: {
          value: s.value as any,
          ...(s.category === undefined ? {} : { category: D.str(s.category) }),
          ...(s.isPublic === undefined ? {} : { isPublic: s.isPublic }),
          updatedBy: D.str(actorId) || null,
        },
      });
    }

    return settings.length;
  });

  void writeAuditLog({
    req,
    actorId,
    action: 'UPDATE',
    entity: 'SystemSetting',
    entityId: 'bulk',
    description: `${count} settings updated`,
  });

  return count;
};

export const createShipment = async (
  subOrderId: string,
  vendorId: string,
  input: {
    methodId?: string;
    partnerId?: string;
    weight?: number;
    charge?: number;
    remarks?: string;
  },
  actorId?: string,
  req?: any,
): Promise<any> => {
  const sub = await prisma.subOrder.findFirst({
    where: { id: subOrderId, vendorId },
    select: { id: true, orderId: true, status: true, trackingNumber: true },
  });

  if (!sub) throw AppError.notFound(ERROR.ORDER.SUB_ORDER_NOT_FOUND);

  const existing = await prisma.shipment.findFirst({
    where: { subOrderId },
    select: { id: true },
  });

  if (existing) {
    throw AppError.unprocessable(ERROR.SHIPPING.SHIPMENT_EXISTS);
  }

  const awb = sub.trackingNumber || generateAwb();

  const row = await prisma.shipment.create({
    data: {
      subOrderId: sub.id,
      orderId: sub.orderId,
      methodId: D.str(input.methodId) || null,
      partnerId: D.str(input.partnerId) || null,
      awb,
      status: 'LABEL_CREATED',
      weight: D.float(input.weight),
      charge: D.float(input.charge),
      remarks: D.str(input.remarks),
    },
  });

  await prisma.delivery.create({
    data: { shipmentId: row.id, subOrderId: sub.id, status: 'PENDING' },
  });

  if (!sub.trackingNumber) {
    await prisma.subOrder.update({ where: { id: sub.id }, data: { trackingNumber: awb } });
  }

  void writeActivityLog({
    req,
    userId: actorId,
    action: 'CREATE',
    entity: 'Shipment',
    entityId: row.id,
    meta: { subOrderId: sub.id, awb },
  });

  return row;
};

export const trackShipment = async (awb: string): Promise<Record<string, any>> => {
  const shipment = await prisma.shipment.findFirst({
    where: { awb: D.str(awb) },
    include: {
      subOrder: {
        select: {
          id: true,
          status: true,
          order: { select: { orderNumber: true } },
        },
      },
    },
  });

  if (!shipment) throw AppError.notFound(ERROR.SHIPPING.SHIPMENT_NOT_FOUND);

  return {
    awb: D.str(shipment.awb),
    orderNumber: D.str(shipment.subOrder?.order?.orderNumber),
    status: D.str(shipment.status),
    trackingUrl: D.str(shipment.trackingUrl),
    estimatedDays: D.num(shipment.estimatedDays),
    shippedAt: D.date(shipment.shippedAt),
    deliveredAt: D.date(shipment.deliveredAt),
    remarks: D.str(shipment.remarks),
  };
};

export const updateDeliveryStatus = async (
  deliveryId: string,
  input: { status: string; latitude?: number; longitude?: number; remarks?: string },
  deliveryBoyUserId: string,
  req?: any,
): Promise<any> => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, status: true, shipmentId: true, deliveryBoyId: true, subOrderId: true },
  });

  if (!delivery) throw AppError.notFound(ERROR.SHIPPING.SHIPMENT_NOT_FOUND);

  const shipment = await prisma.shipment.findUnique({
    where: { id: delivery.shipmentId },
    select: { id: true, status: true },
  });
  if (!shipment) throw AppError.notFound(ERROR.SHIPPING.SHIPMENT_NOT_FOUND);

  const rider = await prisma.deliveryBoy.findUnique({
    where: { userId: deliveryBoyUserId },
    select: { id: true, isActive: true },
  });
  if (!rider || !rider.isActive || delivery.deliveryBoyId !== rider.id) {
    throw AppError.forbidden(ERROR.COMMON.FORBIDDEN);
  }

  const status = D.str(input.status).toUpperCase();
  if (status === 'DELIVERED') {
    throw AppError.badRequest('Use OTP verification to complete a delivery.');
  }

  const allowed = SHIPMENT_STATUS_TRANSITIONS[shipment.status] ?? [];
  if (!allowed.includes(status)) {
    throw AppError.unprocessable(
      `${ERROR.ORDER.INVALID_STATUS_TRANSITION} (${shipment.status} -> ${status})`,
      ERROR_CODE.INVALID_STATUS_TRANSITION,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const shipmentResult = await tx.shipment.updateMany({
      where: { id: shipment.id, status: shipment.status },
      data: { status: status as any },
    });
    if (shipmentResult.count !== 1) {
      throw AppError.unprocessable(ERROR.ORDER.INVALID_STATUS_TRANSITION, ERROR_CODE.INVALID_STATUS_TRANSITION);
    }

    const deliveryResult = await tx.delivery.updateMany({
      where: { id: delivery.id, status: delivery.status },
      data: {
        status: status as any,
        ...(status === 'FAILED' || status === 'RETURNED'
          ? { deliveryOtp: '', deliveryOtpExpiresAt: null }
          : {}),
        ...(input.latitude === undefined ? {} : { latitude: D.float(input.latitude) }),
        ...(input.longitude === undefined ? {} : { longitude: D.float(input.longitude) }),
        ...(input.remarks === undefined ? {} : { remarks: D.str(input.remarks) }),
      },
    });
    if (deliveryResult.count !== 1) {
      throw AppError.unprocessable(ERROR.ORDER.INVALID_STATUS_TRANSITION, ERROR_CODE.INVALID_STATUS_TRANSITION);
    }

    return tx.delivery.findUnique({ where: { id: delivery.id } });
  });

  void writeActivityLog({
    req,
    userId: deliveryBoyUserId,
    action: 'UPDATE',
    entity: 'Delivery',
    entityId: delivery.id,
    meta: { status },
  });

  return updated;
};

export const getSettingsByCategory = async (category: string): Promise<Record<string, any>> =>
  getSettingByCategory(category);

export const resetSettings = async (
  actorId?: string,
  req?: any,
): Promise<{ resetCount: number }> => {
  const resetCount = await resetSettingsToDefault(SETTINGS);

  void writeAuditLog({
    req,
    actorId,
    action: 'RESET',
    entity: 'SystemSetting',
    description: `Reset ${resetCount} settings to their seeded defaults`,
  });

  return { resetCount };
};

export const setMaintenanceMode = async (
  input: { enabled: boolean; message?: string; allowedIps?: string[] },
  actorId?: string,
  req?: any,
): Promise<Record<string, any>> => {
  await setSetting(
    SETTING_KEY.MAINTENANCE_ENABLED,
    Boolean(input.enabled),
    SETTING_CATEGORY.SYSTEM,
    actorId,
  );

  if (input.message !== undefined) {
    await setSetting(
      SETTING_KEY.MAINTENANCE_MESSAGE,
      D.str(input.message),
      SETTING_CATEGORY.SYSTEM,
      actorId,
      true,
    );
  }

  if (input.allowedIps !== undefined) {
    await setSetting(
      SETTING_KEY.MAINTENANCE_ALLOWED_IPS,
      D.strArr(input.allowedIps),
      SETTING_CATEGORY.SYSTEM,
      actorId,
    );
  }

  void writeAuditLog({
    req,
    actorId,
    action: 'TOGGLE',
    entity: 'SystemSetting',
    entityId: 'maintenanceEnabled',
    description: `Maintenance mode ${input.enabled ? 'enabled' : 'disabled'}`,
  });

  return getMaintenanceStatus();
};
