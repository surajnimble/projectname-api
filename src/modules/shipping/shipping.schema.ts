import { z } from 'zod';

import { ERROR } from '../../messages/error';
import { Role, ShipmentStatus } from '@prisma/client';
import { VALIDATION } from '../../messages/validation';
import { NAME } from '../../config/password.config';
import { PHONE_REGEX } from '../../constants/countries';
import { common, paginationSchema } from '../../middlewares/validate.middleware';

const id = common.cuid;

const phone = z.string().trim().max(15).regex(PHONE_REGEX, VALIDATION.INVALID_PHONE);

export const listZonesSchema = z
  .object({
    isActive: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

export const createZoneSchema = z
  .object({
    name: z.string().trim().min(2, VALIDATION.MIN_LENGTH('name', 2)).max(NAME.TITLE_MAX_LENGTH),
    countries: z.array(z.string().trim().min(2).max(3)).max(50).optional().default([]),
    states: z.array(z.string().trim().min(2).max(80)).max(200).optional().default([]),
    pincodes: z
      .array(
        z
          .string()
          .trim()
          .regex(/^\d{4,10}$/, VALIDATION.INVALID_PINCODE),
      )
      .max(500)
      .optional()
      .default([]),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateZoneSchema = createZoneSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: VALIDATION.INVALID_JSON });

export const zoneIdParamSchema = z.object({ id });

export const toggleZoneSchema = z
  .object({
    isActive: z.boolean().optional(),
  })
  .strict();

export const listMethodsSchema = z
  .object({
    zoneId: id.optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

const methodBody = z
  .object({
    zoneId: id.optional().or(z.literal('')),
    name: z.string().trim().min(2, VALIDATION.MIN_LENGTH('name', 2)).max(NAME.TITLE_MAX_LENGTH),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,24}$/, 'Code may contain A-Z, 0-9, _ and - only.'),
    description: z.string().trim().max(NAME.COMMENT_MAX_LENGTH).optional(),
    baseCharge: z.coerce.number().min(0).optional().default(0),
    perKgCharge: z.coerce.number().min(0).optional().default(0),
    freeAbove: z.coerce.number().min(0).optional().default(0),
    minDays: z.coerce.number().int().min(1).optional().default(1),
    maxDays: z.coerce.number().int().min(1).optional().default(7),
    isCodAllowed: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const createMethodSchema = methodBody.superRefine((v, ctx) => {
  if (D_max(v) < D_min(v)) {
    ctx.addIssue({ code: 'custom', message: ERROR.SHIPPING.DELIVERY_WINDOW_INVALID });
  }
});

export const updateMethodSchema = methodBody.partial().superRefine((v, ctx) => {
  if (Object.keys(v).length === 0) {
    ctx.addIssue({ code: 'custom', message: VALIDATION.INVALID_JSON });
  }
  if (D_max(v) < D_min(v)) {
    ctx.addIssue({ code: 'custom', message: ERROR.SHIPPING.DELIVERY_WINDOW_INVALID });
  }
});

const D_min = (v: { minDays?: number }): number => Number(v.minDays ?? 1);
const D_max = (v: { maxDays?: number }): number => Number(v.maxDays ?? 7);

export const createPartnerSchema = z
  .object({
    name: z.string().trim().min(2, VALIDATION.MIN_LENGTH('name', 2)).max(NAME.TITLE_MAX_LENGTH),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,24}$/, 'Code may contain A-Z, 0-9, _ and - only.'),
    apiUrl: z.string().trim().url(VALIDATION.INVALID_URL).optional().default(''),

    apiKey: z.string().trim().max(200).optional().default(''),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updatePartnerSchema = createPartnerSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: VALIDATION.INVALID_JSON });

export const partnerIdParamSchema = z.object({ id });

export const awbParamSchema = z
  .object({ awb: z.string().trim().min(4, 'Enter a valid tracking number.').max(40) })
  .strict();

export const subOrderIdParamSchema = z.object({ subOrderId: common.cuid });

export const checkServiceableSchema = z
  .object({
    pincode: z
      .string()
      .trim()
      .regex(/^\d{4,10}$/, VALIDATION.INVALID_PINCODE),
    country: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
  })
  .strict();

export const calculateRateSchema = z
  .object({
    pincode: z
      .string()
      .trim()
      .regex(/^\d{4,10}$/, VALIDATION.INVALID_PINCODE),
    weightKg: z.coerce.number().min(0).optional().default(0.5),
    orderValue: z.coerce.number().min(0).optional().default(0),
    methodId: id.optional(),
  })
  .strict();

export const listDeliveryBoysSchema = z
  .object({
    isActive: z.enum(['true', 'false']).optional(),
    zoneId: id.optional(),
    search: z.string().trim().max(120).optional(),
    availableOnly: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

export const createDeliveryBoySchema = z
  .object({
    userId: id,
    name: z.string().trim().min(2, VALIDATION.MIN_LENGTH('name', 2)).max(NAME.MAX_LENGTH),
    phone,
    email: z
      .union([z.string().trim().email(VALIDATION.INVALID_EMAIL), z.literal('')])
      .optional()
      .default(''),
    vehicleType: z
      .enum(['BIKE', 'CAR', 'VAN', 'TRUCK', 'CYCLE', 'WALK'])
      .optional()
      .default('BIKE'),
    vehicleNo: z.string().trim().max(30).optional().default(''),
    zoneId: id.optional().or(z.literal('')),
  })
  .strict();

export const updateDeliveryBoySchema = createDeliveryBoySchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: VALIDATION.INVALID_JSON });

export const toggleDeliveryBoySchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const deliveryBoyIdParamSchema = z.object({ id });

export const listSettingsSchema = z
  .object({
    category: z.string().trim().max(50).optional(),
    isPublic: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

export const updateSettingSchema = z
  .object({
    key: z.string().trim().min(2, VALIDATION.REQUIRED('key')).max(120),
    value: z.unknown(),
    category: z.string().trim().max(50).optional(),
    isPublic: z.boolean().optional(),
  })
  .strict();

export const bulkUpdateSettingsSchema = z
  .object({
    settings: z
      .array(
        z
          .object({
            key: z.string().trim().min(2).max(120),
            value: z.unknown(),
            category: z.string().trim().max(50).optional(),
            isPublic: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const settingKeyParamSchema = z.object({ key: z.string().trim().min(2).max(120) });

export const settingCategoryParamSchema = z.object({
  category: z.string().trim().min(2, VALIDATION.REQUIRED('category')).max(40),
});

export const toggleFeatureSchema = z
  .object({
    key: z.string().trim().min(2, VALIDATION.REQUIRED('key')).max(120),
    enabled: z.boolean(),
  })
  .strict();

export const updateMaintenanceSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(300).optional(),
    allowedIps: common.csvArray,
  })
  .strict();







export const createShipmentSchema = z
  .object({
    methodId: id.optional(),
    partnerId: id.optional(),
    weight: z.coerce.number().min(0).optional(),
    charge: z.coerce.number().min(0).optional(),
    remarks: z.string().trim().max(300).optional(),
  })
  .strict();

export const shipmentStatusSchema = z
  .object({
    status: z.nativeEnum(ShipmentStatus),
    otp: z.string().trim().regex(/^\d{4}$/, 'Enter the 4-digit delivery OTP.').optional(),
    remarks: z.string().trim().max(300).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === ShipmentStatus.DELIVERED && !value.otp) {
      ctx.addIssue({ code: 'custom', path: ['otp'], message: 'Delivery OTP is required.' });
    }
    if (value.status !== ShipmentStatus.DELIVERED && value.otp) {
      ctx.addIssue({ code: 'custom', path: ['otp'], message: 'OTP is only accepted when completing delivery.' });
    }
  });













export const roleParamSchema = z.object({ role: z.nativeEnum(Role) });

export const roleIdParamSchema = z.object({ id: z.nativeEnum(Role) });





export type CreateZoneInput = z.infer<typeof createZoneSchema>;
