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
import { getRolePermissions, getUserPermissions } from '../../middlewares/rbac.middleware';
import { PERMISSION_VALUES } from '../../constants/permissions';
import * as service from './admin.service';
import {
  serializeAuditLog,
  serializeActivityLog,
  serializeFailedJobList,
  serializeUser,
} from '../../utils/serialize';

const actorId = (req: Request): string => req.auth!.userId;

export const guards = {
  admin: [requireRole(ROLES.SUPER_ADMIN, ROLES.SUB_ADMIN)],
  superAdmin: [requireRole(ROLES.SUPER_ADMIN)],
};

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Headline counts across the platform (admin)
 *     responses:
 *       200: { description: Dashboard summary }
 */
export const dashboard = asyncHandler(async (req, res) => {
  const result = await service.getDashboard(req.auth!.permissions ?? []);
  return ApiResponse.success(res, { message: SUCCESS.ADMIN.DASHBOARD_FETCHED, result });
});

export const subAdminCreate = asyncHandler(async (req, res) => {
  const row = await service.createSubAdmin(req.body, actorId(req), req);
  return ApiResponse.created(res, SUCCESS.ADMIN.SUB_ADMIN_CREATED, row);
});

export const subAdminList = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listSubAdmins({ ...(req.query as any), skip, take });

  const subAdmins = await Promise.all(
    rows.map(async (user: any) =>
      serializeUser(user, await getUserPermissions(D.str(user.id), D.str(user.role))),
    ),
  );

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.SUB_ADMINS_FETCHED,
    result: { subAdminList: subAdmins },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const permissionsGet = asyncHandler(async (req, res) => {
  const list = await service.listRolePermissions(D.str(req.params.role));

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.PERMISSIONS_FETCHED,
    result: { role: D.str(req.params.role), itemCount: list.length, permissionList: list },
  });
});

export const permissionsSet = asyncHandler(async (req, res) => {
  const count = await service.setRolePermissions(
    D.str(req.params.role),
    req.body.permissions,
    actorId(req),
    req,
  );

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.PERMISSIONS_UPDATED,
    result: { role: D.str(req.params.role), permissionCount: D.num(count) },
  });
});

export const auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listAuditLogs({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.AUDIT_LOGS_FETCHED,
    result: { auditLogList: rows.map(serializeAuditLog) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const activityLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const { rows, total } = await service.listActivityLogs({ ...(req.query as any), skip, take });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.ACTIVITY_LOGS_FETCHED,
    result: { activityLogList: rows.map(serializeActivityLog) },
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

export const auditLogById = asyncHandler(async (req, res) => {
  const row = await service.getAuditLogById(D.str(req.params.id));

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.AUDIT_LOGS_FETCHED,
    result: serializeAuditLog(row),
  });
});

export const auditLogsByActor = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);
  const actorId = D.str(req.params.userId);

  const { rows, total } = await service.listAuditLogs({
    ...(req.query as any),
    actorId,
    skip,
    take,
  });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.AUDIT_LOGS_FETCHED,
    result: { actorId, auditLogList: rows.map(serializeAuditLog) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

export const exportAuditLogs = asyncHandler(async (req, res) => {
  const { rows } = await service.listAuditLogs({ ...(req.query as any), take: 10_000 });

  const header = ['createdAt', 'actorId', 'action', 'entity', 'entityId', 'description', 'ip'].join(
    ',',
  );

  const body = rows
    .map((r: any) =>
      [
        D.date(r.createdAt),
        D.str(r.actorId),
        D.str(r.action),
        D.str(r.entity),
        D.str(r.entityId),
        `"${D.str(r.description).replace(/"/g, '""')}"`,
        D.str(r.ip),
      ].join(','),
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');

  return res.status(200).send(`${header}\n${body}`);
});

export const purgeAuditLogs = asyncHandler(async (req, res) => {
  const result = await service.purgeAuditLogs(D.num(req.body.beforeDays), actorId(req), req);

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.AUDIT_LOGS_PURGED,
    result,
  });
});

export const subAdminUpdate = asyncHandler(async (req, res) => {
  const row = await service.updateSubAdmin(D.str(req.params.id), req.body, actorId(req), req);

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.SUB_ADMIN_UPDATED,
    result: serializeUser(row),
  });
});

export const subAdminDelete = asyncHandler(async (req, res) => {
  await service.deleteSubAdmin(D.str(req.params.id), actorId(req), req);

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.SUB_ADMIN_DELETED,
    result: { userId: D.str(req.params.id), isDeleted: true },
  });
});

export const subAdminToggle = asyncHandler(async (req, res) => {
  const row = await service.toggleSubAdmin(
    D.str(req.params.id),
    Boolean(req.body.enabled),
    actorId(req),
    req,
  );

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.SUB_ADMIN_STATUS_UPDATED,
    result: { userId: D.str(row.id), isActive: D.bool(row.isActive) },
  });
});

export const allPermissions = asyncHandler(async (_req, res) => {
  const stored = await service.listAllRolePermissions();
  const roleList = { ...stored, [ROLES.SUB_ADMIN]: await getRolePermissions(ROLES.SUB_ADMIN) };

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.PERMISSIONS_FETCHED,
    result: { roleList, permissionList: [...PERMISSION_VALUES] },
  });
});

export const permissionsSetForUser = asyncHandler(async (req, res) => {
  const userId = D.str(req.params.id);
  const count = await service.setUserPermissions(
    userId,
    req.body.permissions,
    actorId(req),
    req,
  );

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.PERMISSIONS_UPDATED,
    result: { userId, permissionCount: D.num(count) },
  });
});

export const clearCache = asyncHandler(async (req, res) => {
  const flushed = await service.clearAllCaches(actorId(req), req);

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.CACHE_CLEARED,
    result: { isFlushed: D.bool(flushed) },
  });
});

export const cronJobs = asyncHandler(async (_req, res) => {
  const result = await service.listCronJobDefinitions();

  return ApiResponse.success(res, {
    message: SUCCESS.ADMIN.CRON_JOBS_FETCHED,
    result: { jobCount: result.length, jobList: result },
  });
});

export const triggerJob = asyncHandler(async (req, res) => {
  const result = await service.triggerCronJobNow(D.str(req.body.name), actorId(req), req);

  return ApiResponse.success(res, { message: SUCCESS.ADMIN.JOB_TRIGGERED, result });
});

export const failedJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { rows, total, pending, counts } = await service.listFailedJobRecords({
    ...req.query,
    skip,
    take: limit,
  });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ADMIN.FAILED_JOBS_FETCHED,
    result: {
      pendingCount: D.num(pending),
      filterData: {
        status: D.str(req.query.status as string),
        queue: D.str(req.query.queue as string),
        jobName: D.str(req.query.jobName as string),
        search: D.str(req.query.search as string),
      },
      countsData: {
        pendingCount: D.num(counts.pending),
        resolvedCount: D.num(counts.resolved),
        abandonedCount: D.num(counts.abandoned),
      },
      ...serializeFailedJobList(rows),
    },
    totalRecord: total,
    totalPage: Math.ceil(total / limit),
    currentPage: page,
    limit,
    hasNext: page * limit < total,
    hasPrevious: page > 1,
    nextPage: page * limit < total ? page + 1 : 0,
    previousPage: page > 1 ? page - 1 : 0,
  });
});

export const retryFailedJob = asyncHandler(async (req, res) => {
  const result = await service.retryFailedJobRecord(D.str(req.params.id), actorId(req), req);

  return ApiResponse.success(res, { message: SUCCESS.ADMIN.FAILED_JOB_RETRIED, result });
});

export const resolveFailedJob = asyncHandler(async (req, res) => {
  const result = await service.resolveFailedJobRecord(D.str(req.params.id), actorId(req), req);

  return ApiResponse.success(res, { message: SUCCESS.ADMIN.FAILED_JOB_RESOLVED, result });
});

export const deleteFailedJob = asyncHandler(async (req, res) => {
  const result = await service.removeFailedJobRecord(D.str(req.params.id), actorId(req), req);

  return ApiResponse.success(res, { message: SUCCESS.ADMIN.FAILED_JOB_DELETED, result });
});
