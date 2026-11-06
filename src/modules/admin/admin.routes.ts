import { Router } from 'express';
import { validate, idParamSchema } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/rbac.middleware';
import { PERMISSION } from '../../constants/permissions';
import * as controller from './admin.controller';
import * as schema from './admin.schema';

const admin = Router();

admin.get(
  '/getDashboardStats',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.DASHBOARD_VIEW),
  controller.dashboard,
);

admin.get(
  '/getSystemHealth',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SYSTEM_HEALTH_VIEW),
  controller.health,
);

admin.post(
  '/createSubAdmin',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.SUB_ADMIN_MANAGE),
  validate({ body: schema.createSubAdminSchema }),
  controller.subAdminCreate,
);

admin.get(
  '/getAllSubAdmins',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.SUB_ADMIN_MANAGE),
  validate({ query: schema.listSubAdminsSchema }),
  controller.subAdminList,
);

admin.patch(
  '/updateSubAdmin/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.SUB_ADMIN_MANAGE),
  validate({ params: idParamSchema, body: schema.updateSubAdminSchema }),
  controller.subAdminUpdate,
);

admin.delete(
  '/deleteSubAdmin/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.SUB_ADMIN_MANAGE),
  validate({ params: idParamSchema }),
  controller.subAdminDelete,
);

admin.patch(
  '/toggleSubAdminStatus/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.SUB_ADMIN_MANAGE),
  validate({ params: idParamSchema, body: schema.toggleSubAdminSchema }),
  controller.subAdminToggle,
);

admin.get(
  '/getPermissions',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.ROLE_PERMISSION_MANAGE),
  controller.allPermissions,
);

admin.patch(
  '/updatePermissions/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.ROLE_PERMISSION_MANAGE),
  validate({ params: idParamSchema, body: schema.setPermissionsSchema }),
  controller.permissionsSetForUser,
);

admin.get(
  '/getAuditLogs',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.AUDIT_LOG_VIEW),
  validate({ query: schema.listAuditLogsSchema }),
  controller.auditLogs,
);

admin.get(
  '/getActivityLogs',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.ACTIVITY_LOG_VIEW),
  validate({ query: schema.listActivityLogsSchema }),
  controller.activityLogs,
);

admin.post(
  '/clearCache',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CACHE_CLEAR),
  controller.clearCache,
);

admin.get(
  '/getCronJobs',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CRON_TRIGGER),
  controller.cronJobs,
);

admin.post(
  '/triggerJob',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CRON_TRIGGER),
  validate({ body: schema.triggerJobSchema }),
  controller.triggerJob,
);

admin.get(
  '/getFailedJobs',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CRON_TRIGGER),
  validate({ query: schema.listFailedJobsSchema }),
  controller.failedJobs,
);

admin.post(
  '/retryFailedJob/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CRON_TRIGGER),
  validate({ params: schema.failedJobIdParamSchema }),
  controller.retryFailedJob,
);

admin.patch(
  '/resolveFailedJob/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CRON_TRIGGER),
  validate({ params: schema.failedJobIdParamSchema }),
  controller.resolveFailedJob,
);

admin.delete(
  '/deleteFailedJob/:id',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.CRON_TRIGGER),
  validate({ params: schema.failedJobIdParamSchema }),
  controller.deleteFailedJob,
);

export const adminRoutes = admin;

const audit = Router();

audit.get(
  '/getAll',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.AUDIT_LOG_VIEW),
  validate({ query: schema.listAuditLogsSchema }),
  controller.auditLogs,
);

audit.get(
  '/getById/:id',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.AUDIT_LOG_VIEW),
  validate({ params: idParamSchema }),
  controller.auditLogById,
);

audit.get(
  '/getByActor/:userId',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.AUDIT_LOG_VIEW),
  validate({ params: schema.actorParamSchema, query: schema.listAuditLogsSchema }),
  controller.auditLogsByActor,
);

audit.get(
  '/export',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.AUDIT_LOG_VIEW),
  validate({ query: schema.listAuditLogsSchema }),
  controller.exportAuditLogs,
);

audit.delete(
  '/purge',
  authenticate,
  ...controller.guards.superAdmin,
  requirePermission(PERMISSION.AUDIT_LOG_PURGE),
  validate({ body: schema.purgeAuditLogsSchema }),
  controller.purgeAuditLogs,
);

export const auditRoutes = audit;

export const activityLogRoutes = Router().get(
  '/getAll',
  authenticate,
  ...controller.guards.admin,
  requirePermission(PERMISSION.ACTIVITY_LOG_VIEW),
  validate({ query: schema.listActivityLogsSchema }),
  controller.activityLogs,
);
