import { z } from 'zod';
import { AdminAction } from '@prisma/client';
import { ERROR } from '../../messages/error';
import { VALIDATION } from '../../messages/validation';
import { FAILED_JOB_STATUS } from '../../constants/statuses';
import { PERMISSION_VALUES, type Permission } from '../../constants/permissions';
import { NAME } from '../../config/password.config';
import { PHONE_REGEX } from '../../constants/countries';
import { common, paginationSchema } from '../../middlewares/validate.middleware';

const id = common.cuid;
const phone = z.string().trim().max(15).regex(PHONE_REGEX, VALIDATION.INVALID_PHONE);
const permissionValue = z.string().trim().refine(
  (value) => PERMISSION_VALUES.includes(value as Permission),
  { message: VALIDATION.INVALID_JSON },
);

export const triggerJobSchema = z
  .object({
    name: z.string().trim().min(2, VALIDATION.REQUIRED('name')).max(60),
  })
  .strict();

export const listFailedJobsSchema = z
  .object({
    status: z.nativeEnum(FAILED_JOB_STATUS).optional(),
    queue: z.string().trim().max(40).optional(),
    jobName: z.string().trim().max(60).optional(),
  })
  .merge(paginationSchema)
  .strict();

export const failedJobIdParamSchema = z.object({ id });

export const createSubAdminSchema = z
  .object({
    name: z.string().trim().min(2, VALIDATION.MIN_LENGTH('name', 2)).max(NAME.MAX_LENGTH),
    email: z.string().trim().email(VALIDATION.INVALID_EMAIL),
    phone,
    password: z.string().min(8).max(64),
    permissions: z.array(permissionValue).max(100).optional().default([]),
  })
  .strict();

export const updateSubAdminSchema = z
  .object({
    name: z.string().trim().min(2).max(NAME.MAX_LENGTH).optional(),
    email: z.string().trim().email(VALIDATION.INVALID_EMAIL).optional(),
    phone: phone.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: VALIDATION.INVALID_JSON });

export const listSubAdminsSchema = z
  .object({
    isActive: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

export const setPermissionsSchema = z
  .object({
    permissions: z.array(permissionValue).max(200),
  })
  .strict();

export const listAuditLogsSchema = z
  .object({
    actorId: id.optional(),
    action: z.nativeEnum(AdminAction).optional(),
    entity: z.string().trim().max(60).optional(),
    entityId: z.string().trim().max(60).optional(),
    from: common.isoDate.optional(),
    to: common.isoDate.optional(),
  })
  .merge(paginationSchema)
  .strict();

export const listActivityLogsSchema = z
  .object({
    userId: id.optional(),
    action: z.string().trim().max(60).optional(),
    entity: z.string().trim().max(60).optional(),
    from: common.isoDate.optional(),
    to: common.isoDate.optional(),
  })
  .merge(paginationSchema)
  .strict();

export const actorParamSchema = z.object({ userId: common.cuid });

export const purgeAuditLogsSchema = z
  .object({
    beforeDays: z.coerce.number().int().min(1).max(3650),
  })
  .strict();

export const toggleSubAdminSchema = z
  .object({ enabled: z.boolean() })
  .strict();
