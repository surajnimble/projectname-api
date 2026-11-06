import { Prisma } from '@prisma/client';
import { ROLES, PAYMENT_STATUS } from '../../constants/roles';
import { PERMISSION, PERMISSION_VALUES, type Permission } from '../../constants/permissions';
import { FAILED_JOB_STATUS } from '../../constants/statuses';
import { prisma } from '../../services/prisma.service';
import { writeActivityLog, writeAuditLog } from '../../services/audit.service';
import { cacheDel } from '../../services/redis.service';
import { REDIS_KEYS } from '../../config/tracking.config';
import { AppError } from '../../utils/AppError';
import { D } from '../../utils/defaults';
import { ERROR } from '../../messages/error';
import { ERROR_CODE, HTTP_STATUS } from '../../constants/http';

export const clearAllCaches = async (actorId?: string, req?: any): Promise<boolean> => {
  const { flushCache } = await import('../../services/redis.service');
  const flushed = await flushCache();

  void writeAuditLog({
    req,
    actorId,
    action: 'RESET',
    entity: 'Cache',
    description: flushed ? 'Redis cache flushed' : 'Redis unavailable, nothing flushed',
  });

  return flushed;
};

export const listCronJobDefinitions = async () => {
  const { listCronJobs } = await import('../../jobs/cron');
  return listCronJobs();
};

export const triggerCronJobNow = async (
  name: string,
  actorId?: string,
  req?: any,
): Promise<{ triggered: boolean; name: string }> => {
  const { triggerCronJob } = await import('../../jobs/cron');
  const result = await triggerCronJob(name);

  void writeAuditLog({
    req,
    actorId,
    action: 'TOGGLE',
    entity: 'CronJob',
    entityId: name,
    description: result.triggered ? 'Cron job triggered' : 'Cron job could not be triggered',
  });

  return result;
};

export const listFailedJobRecords = async (query: Record<string, any>) => {
  const { listFailedJobs, getFailedJobCounts } = await import('../../jobs/deadletter.service');
  const [page, counts] = await Promise.all([listFailedJobs(query), getFailedJobCounts()]);
  return { ...page, counts };
};

export const retryFailedJobRecord = async (
  id: string,
  actorId?: string,
  req?: any,
): Promise<{ retried: boolean; replayCount: number; jobName: string; queue: string }> => {
  const { getFailedJob, retryFailedJob } = await import('../../jobs/deadletter.service');

  const row = await getFailedJob(id);
  if (!row)
    throw new AppError(
      ERROR.SYSTEM.FAILED_JOB_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODE.FAILED_JOB_NOT_FOUND,
    );
  if (row.status !== FAILED_JOB_STATUS.PENDING) {
    throw new AppError(
      ERROR.SYSTEM.FAILED_JOB_ALREADY_RESOLVED,
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.FAILED_JOB_ALREADY_RESOLVED,
    );
  }

  const result = await retryFailedJob(row);

  if (!result.retried && result.reason === 'REPLAY_LIMIT') {
    throw new AppError(
      ERROR.SYSTEM.FAILED_JOB_REPLAY_LIMIT,
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.FAILED_JOB_REPLAY_LIMIT,
    );
  }
  if (!result.retried) {
    throw new AppError(
      ERROR.SYSTEM.QUEUE_UNAVAILABLE,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      ERROR_CODE.FAILED_JOB_QUEUE_UNAVAILABLE,
    );
  }

  void writeAuditLog({
    req,
    actorId,
    action: 'UPDATE',
    entity: 'FailedJob',
    entityId: row.id,
    description: `Replayed ${row.queue}/${row.jobName}`,
  });

  return {
    retried: result.retried,
    replayCount: result.replayCount,
    jobName: row.jobName,
    queue: row.queue,
  };
};

export const resolveFailedJobRecord = async (
  id: string,
  actorId?: string,
  req?: any,
): Promise<{ resolved: boolean; jobName: string; queue: string }> => {
  const { getFailedJob, resolveFailedJob } = await import('../../jobs/deadletter.service');

  const row = await getFailedJob(id);
  if (!row)
    throw new AppError(
      ERROR.SYSTEM.FAILED_JOB_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODE.FAILED_JOB_NOT_FOUND,
    );
  if (row.status !== FAILED_JOB_STATUS.PENDING) {
    throw new AppError(
      ERROR.SYSTEM.FAILED_JOB_ALREADY_RESOLVED,
      HTTP_STATUS.CONFLICT,
      ERROR_CODE.FAILED_JOB_ALREADY_RESOLVED,
    );
  }

  await resolveFailedJob(id, D.str(actorId));

  void writeAuditLog({
    req,
    actorId,
    action: 'UPDATE',
    entity: 'FailedJob',
    entityId: row.id,
    description: `Resolved ${row.queue}/${row.jobName}`,
  });

  return { resolved: true, jobName: row.jobName, queue: row.queue };
};

export const removeFailedJobRecord = async (
  id: string,
  actorId?: string,
  req?: any,
): Promise<{ deleted: boolean }> => {
  const { getFailedJob, deleteFailedJob } = await import('../../jobs/deadletter.service');

  const row = await getFailedJob(id);
  if (!row)
    throw new AppError(
      ERROR.SYSTEM.FAILED_JOB_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      ERROR_CODE.FAILED_JOB_NOT_FOUND,
    );

  const deleted = await deleteFailedJob(id);

  void writeAuditLog({
    req,
    actorId,
    action: 'DELETE',
    entity: 'FailedJob',
    entityId: id,
    description: `Deleted ${row.queue}/${row.jobName}`,
  });

  return { deleted };
};

const DASHBOARD_PERMISSION: Record<string, Permission> = {
  totalUsers: PERMISSION.USER_LIST,
  totalVendors: PERMISSION.VENDOR_LIST,
  pendingVendors: PERMISSION.VENDOR_APPROVE,
  totalProducts: PERMISSION.PRODUCT_VIEW_ALL,
  totalOrders: PERMISSION.ORDER_LIST,
  revenue30d: PERMISSION.REPORT_VIEW,
  openTickets: PERMISSION.TICKET_LIST,
  pendingReturns: PERMISSION.RETURN_LIST,
  pendingRefunds: PERMISSION.PAYMENT_LIST,
  pendingAdminOrders: PERMISSION.ORDER_CONFIRM,
};

export const getDashboard = async (granted: string[] = []): Promise<Record<string, any>> => {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const allowed = (permission: Permission): boolean => granted.includes(permission);

  const [
    users,
    vendors,
    pendingVendors,
    products,
    orders,
    revenue,
    openTickets,
    pendingReturns,
    openRefunds,
    pendingAdminOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.vendorProfile.count(),
    prisma.vendorProfile.count({ where: { status: 'PENDING' } }),
    prisma.product.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.aggregate({
      where: { deletedAt: null, createdAt: { gte: since }, paymentStatus: PAYMENT_STATUS.PAID },
      _sum: { total: true },
    }),
    prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.returnRequest.count({
      where: { status: { in: ['REQUESTED', 'APPROVED', 'PICKED_UP'] } },
    }),
    prisma.refund.count({ where: { status: 'PENDING' } }),
    prisma.subOrder.count({ where: { status: 'AWAITING_ADMIN_REVIEW' } }),
  ]);

  const all = {
    totalUsers: users,
    totalVendors: vendors,
    pendingVendors,
    totalProducts: products,
    totalOrders: orders,
    revenue30d: D.float(revenue._sum.total),
    openTickets,
    pendingReturns,
    pendingRefunds: openRefunds,
    pendingAdminOrders,
  };

  return Object.fromEntries(
    Object.entries(all).filter(([field]) => allowed(DASHBOARD_PERMISSION[field])),
  );
};

export const createSubAdmin = async (
  input: { name: string; email: string; phone: string; password: string; permissions?: string[] },
  actorId?: string,
  req?: any,
): Promise<any> => {
  const { hashPassword } = await import('../../utils/crypto');

  const existing = await prisma.user.findUnique({
    where: { email: D.str(input.email).toLowerCase() },
    select: { id: true },
  });

  if (existing) {
    throw AppError.conflict(ERROR.AUTH.EMAIL_EXISTS, ERROR_CODE.EMAIL_EXISTS);
  }

  const permissions = [...new Set(D.strArr(input.permissions))].filter((permission) =>
    PERMISSION_VALUES.includes(permission as Permission),
  );

  const user = await prisma.user.create({
    data: {
      name: D.str(input.name),
      email: D.str(input.email).toLowerCase(),
      phone: D.str(input.phone),
      passwordHash: await hashPassword(input.password),
      role: ROLES.SUB_ADMIN as any,
      subAdminPermissions: permissions,
      hasCustomPermissions: true,
      isActive: true,
      isEmailVerified: true,
    },
  });

  void writeAuditLog({
    req,
    actorId,
    action: 'CREATE',
    entity: 'User',
    entityId: user.id,
    description: `Sub admin ${user.email}`,
  });

  const { serializeUser } = await import('../../utils/serialize');
  return serializeUser(user, permissions);
};

export const listSubAdmins = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.UserWhereInput = { role: ROLES.SUB_ADMIN };

  if (D.str(query.isActive) === 'true') where.isActive = true;
  if (D.str(query.isActive) === 'false') where.isActive = false;

  const term = D.str(query.search).trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.user.count({ where }),
  ]);

  return { rows, total };
};

export const setUserPermissions = async (
  userId: string,
  permissions: string[],
  actorId?: string,
  req?: any,
): Promise<number> => {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: ROLES.SUB_ADMIN, deletedAt: null },
    select: { id: true, email: true },
  });

  if (!user) throw AppError.notFound(ERROR.USER.NOT_FOUND, ERROR_CODE.NOT_FOUND);

  const allowed = [...new Set(D.strArr(permissions))];
  if (allowed.some((permission) => !PERMISSION_VALUES.includes(permission as Permission))) {
    throw AppError.badRequest(ERROR.COMMON.VALIDATION_FAILED, ERROR_CODE.VALIDATION_ERROR);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { subAdminPermissions: allowed, hasCustomPermissions: true },
  });

  await cacheDel(REDIS_KEYS.USER_PERMISSIONS(`user:${userId}`));

  void writeAuditLog({
    req,
    actorId,
    action: 'UPDATE',
    entity: 'UserPermission',
    entityId: userId,
    description: `${allowed.length} permissions set for sub-admin ${user.email}`,
  });

  return allowed.length;
};

export const setRolePermissions = async (
  role: string,
  permissions: string[],
  actorId?: string,
  req?: any,
): Promise<number> => {
  const allowed = D.strArr(permissions);

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { role: role as any } });

    if (allowed.length) {
      await tx.rolePermission.createMany({
        data: allowed.map((p) => ({ role: role as any, permission: p, isAllowed: true })),
      });
    }
  });

  await cacheDel(REDIS_KEYS.USER_PERMISSIONS(role));
  if (role === ROLES.SUB_ADMIN) {
    const inheritedUsers = await prisma.user.findMany({
      where: { role: ROLES.SUB_ADMIN, hasCustomPermissions: false },
      select: { id: true },
    });
    await Promise.all(
      inheritedUsers.map((user) => cacheDel(REDIS_KEYS.USER_PERMISSIONS(`user:${user.id}`))),
    );
  }

  void writeAuditLog({
    req,
    actorId,
    action: 'UPDATE',
    entity: 'RolePermission',
    entityId: role,
    description: `${allowed.length} permissions set for ${role}`,
  });

  return allowed.length;
};

export const listRolePermissions = async (role: string): Promise<string[]> => {
  const rows = await prisma.rolePermission.findMany({
    where: { role: role as any, isAllowed: true },
    select: { permission: true },
  });

  return rows.map((r) => r.permission);
};

export const listAuditLogs = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.AuditLogWhereInput = {};

  if (D.str(query.actorId)) where.actorId = D.str(query.actorId);
  if (D.str(query.action)) where.action = query.action as any;
  if (D.str(query.entity)) where.entity = D.str(query.entity);
  if (D.str(query.entityId)) where.entityId = D.str(query.entityId);

  if (D.str(query.from) || D.str(query.to)) {
    where.createdAt = {
      ...(D.str(query.from) ? { gte: new Date(D.str(query.from)) } : {}),
      ...(D.str(query.to) ? { lte: new Date(D.str(query.to)) } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
        target: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, total };
};

export const getAuditLogById = async (id: string): Promise<any> => {
  const row = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
      target: { select: { id: true, name: true, email: true } },
    },
  });

  if (!row) throw AppError.notFound(ERROR.AUDIT.LOG_NOT_FOUND);

  return row;
};

export const purgeAuditLogs = async (
  beforeDays: number,
  actorId?: string,
  req?: any,
): Promise<{ beforeDays: number; deletedCount: number }> => {
  if (beforeDays <= 0) throw AppError.badRequest(ERROR.AUDIT.INVALID_WINDOW);

  const cutoff = new Date(Date.now() - beforeDays * 86_400_000);
  const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  void writeAuditLog({
    req,
    actorId,
    action: 'DELETE',
    entity: 'AuditLog',
    description: `Purged ${count} audit logs older than ${beforeDays} days`,
  });

  return { beforeDays, deletedCount: count };
};

export const listActivityLogs = async (
  query: Record<string, any>,
): Promise<{ rows: any[]; total: number }> => {
  const where: Prisma.ActivityLogWhereInput = {};

  if (D.str(query.userId)) where.userId = D.str(query.userId);
  if (D.str(query.action)) where.action = D.str(query.action);
  if (D.str(query.entity)) where.entity = D.str(query.entity);

  if (D.str(query.from) || D.str(query.to)) {
    where.createdAt = {
      ...(D.str(query.from) ? { gte: new Date(D.str(query.from)) } : {}),
      ...(D.str(query.to) ? { lte: new Date(D.str(query.to)) } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: D.num(query.skip),
      take: D.num(query.take),
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { rows, total };
};

export const getSystemHealth = async (): Promise<Record<string, any>> => {
  const started = Date.now();

  let dbOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }

  return {
    status: dbOk ? 'healthy' : 'degraded',
    database: { ok: dbOk, latencyMs: Date.now() - started },
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    nodeVersion: process.version,
    checkedAt: new Date().toISOString(),
  };
};

export const updateSubAdmin = async (
  userId: string,
  input: { name?: string; email?: string; phone?: string },
  actorId?: string,
  req?: any,
): Promise<any> => {
  const existing = await prisma.user.findFirst({
    where: { id: userId, role: ROLES.SUB_ADMIN },
    select: { id: true },
  });

  if (!existing) throw AppError.notFound(ERROR.USER.NOT_FOUND);

  if (input.email !== undefined) {
    const taken = await prisma.user.findFirst({
      where: { email: D.str(input.email).toLowerCase(), NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw AppError.conflict(ERROR.AUTH.EMAIL_EXISTS, ERROR_CODE.EMAIL_EXISTS);
  }

  const row = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name === undefined ? {} : { name: D.str(input.name) }),
      ...(input.email === undefined ? {} : { email: D.str(input.email).toLowerCase() }),
      ...(input.phone === undefined ? {} : { phone: D.str(input.phone) }),
    },
  });

  void writeActivityLog({
    req,
    userId: actorId,
    action: 'UPDATE',
    entity: 'User',
    entityId: userId,
    meta: { role: ROLES.SUB_ADMIN },
  });

  return row;
};

export const toggleSubAdmin = async (
  userId: string,
  isActive: boolean,
  actorId?: string,
  req?: any,
): Promise<any> => {
  const existing = await prisma.user.findFirst({
    where: { id: userId, role: ROLES.SUB_ADMIN },
    select: { id: true },
  });

  if (!existing) throw AppError.notFound(ERROR.USER.NOT_FOUND);

  const row = await prisma.user.update({ where: { id: userId }, data: { isActive } });

  void writeActivityLog({
    req,
    userId: actorId,
    action: isActive ? 'ACTIVATE' : 'SUSPEND',
    entity: 'User',
    entityId: userId,
    meta: { role: ROLES.SUB_ADMIN },
  });

  return row;
};

export const deleteSubAdmin = async (
  userId: string,
  actorId?: string,
  req?: any,
): Promise<void> => {
  const existing = await prisma.user.findFirst({
    where: { id: userId, role: ROLES.SUB_ADMIN },
    select: { id: true },
  });

  if (!existing) throw AppError.notFound(ERROR.USER.NOT_FOUND);

  await prisma.user.delete({ where: { id: userId } });

  void writeAuditLog({
    req,
    actorId,
    action: 'DELETE',
    entity: 'User',
    entityId: userId,
    description: 'Sub admin deleted',
  });
};

export const listAllRolePermissions = async (): Promise<Record<string, string[]>> => {
  const rows = await prisma.rolePermission.findMany({
    where: { isAllowed: true },
    select: { role: true, permission: true },
    orderBy: [{ role: 'asc' }, { permission: 'asc' }],
  });

  const out: Record<string, string[]> = {};

  for (const row of rows) {
    const key = D.str(row.role);
    out[key] = [...(out[key] ?? []), D.str(row.permission)];
  }

  return out;
};
