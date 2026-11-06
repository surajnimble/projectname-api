/**
 * Seeds the operations tables: audit and activity trails, API keys, webhook
 * endpoints and their logs, bulk jobs, failed jobs, report schedules and search
 * history.
 */
import { PrismaClient } from '@prisma/client';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { IdentityContext } from './types';

/** Adds audit and activity rows for the admin log screens. */
const seedLogs = async (prisma: PrismaClient, identity: IdentityContext): Promise<void> => {
  const auditSeeds = [
    { action: 'CREATE', entity: 'Product', description: 'Created a product' },
    { action: 'UPDATE', entity: 'Order', description: 'Updated order status' },
    { action: 'APPROVE', entity: 'Vendor', description: 'Approved a vendor' },
    { action: 'SEND', entity: 'Notification', description: 'Sent a notification blast' },
    { action: 'CREATE', entity: 'Coupon', description: 'Created a coupon campaign' },
    { action: 'UPDATE', entity: 'Vendor', description: 'Updated vendor commission' },
    { action: 'APPROVE', entity: 'ReturnRequest', description: 'Approved a customer return' },
  ];

  for (const [index, log] of auditSeeds.entries()) {
    await seedRow(prisma, 'auditLog', demoId('audit-log', index + 1), {
      actorId: identity.superAdminId,
      actorRole: 'SUPER_ADMIN',
      action: log.action as any,
      entity: log.entity,
      entityId: demoId('entity', index + 1),
      description: log.description,
      changes: { before: {}, after: {} },
      meta: { source: 'demo-seed' },
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (demo seed)',
      requestId: demoId('request', index + 1),
      createdAt: daysFromNow(-index),
    });
  }

  for (const [index, action] of [
    'LOGIN',
    'PRODUCT_VIEW',
    'ADD_TO_CART',
    'ORDER_PLACED',
    'PAYMENT_COMPLETED',
    'WISHLIST_UPDATED',
    'RETURN_REQUESTED',
  ].entries()) {
    await seedRow(prisma, 'activityLog', demoId('activity-log', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      action,
      entity: index === 0 ? 'Session' : 'Product',
      entityId: demoId('activity-entity', index + 1),
      meta: { source: 'demo-seed' },
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (demo seed)',
      deviceId: `demo-device-${index + 1}`,
      requestId: demoId('request', index + 1),
      createdAt: daysFromNow(-index),
    });
  }
};

/** Adds API keys, webhook endpoints and delivery logs. */
const seedIntegrations = async (prisma: PrismaClient, identity: IdentityContext): Promise<void> => {
  for (const [index, apiKey] of [
    { name: 'Storefront read', scopes: ['product:read', 'category:read'] },
    { name: 'Mobile app', scopes: ['cart:write', 'order:read'] },
    { name: 'Partner sync', scopes: ['order:read', 'product:read'] },
    { name: 'Warehouse sync', scopes: ['inventory:read', 'inventory:write'] },
    { name: 'Reporting connector', scopes: ['analytics:read', 'report:read'] },
    { name: 'Support portal', scopes: ['ticket:read', 'ticket:write'] },
    { name: 'Marketplace mobile', scopes: ['product:read', 'order:read'] },
  ].entries()) {
    const key = `demo-api-key-${index + 1}`;
    await seedRowBy(prisma, 'apiKey', { key }, demoId('api-key', index + 1), {
      name: apiKey.name,
      key,
      secretHash: `demo-secret-hash-${index + 1}`,
      prefix: `demo${index + 1}`,
      scopes: apiKey.scopes,
      isActive: index !== 2,
      expiresAt: index === 2 ? daysFromNow(-1) : daysFromNow(90),
      lastUsedAt: daysFromNow(-index),
      usageCount: 40 + index * 10,
      createdById: identity.superAdminId,
      revokedAt: index === 2 ? daysFromNow(-2) : null,
    });
  }

  for (const [index, endpoint] of [
    { url: 'https://partner.example.com/webhooks/orders', events: ['order.created'] },
    { url: 'https://crm.example.com/hooks/customer', events: ['customer.created'] },
    { url: 'https://analytics.example.com/collect', events: ['product.viewed'] },
    { url: 'https://warehouse.example.com/hooks/stock', events: ['inventory.updated'] },
    { url: 'https://billing.example.com/hooks/payments', events: ['payment.captured'] },
    { url: 'https://support.example.com/hooks/tickets', events: ['ticket.created'] },
    { url: 'https://mobile.example.com/hooks/orders', events: ['order.updated'] },
  ].entries()) {
    await seedRow(prisma, 'webhookEndpoint', demoId('webhook-endpoint', index + 1), {
      url: endpoint.url,
      events: endpoint.events,
      secret: `demo-webhook-secret-${index + 1}`,
      provider: index === 0 ? 'SHIPPING' : 'CUSTOM',
      isActive: index !== 2,
      failureCount: index,
      lastFiredAt: daysFromNow(-index),
    });
  }

  const endpoints = await prisma.webhookEndpoint.findMany({ select: { id: true }, take: 7 });
  for (const [index, log] of [
    { direction: 'INBOUND', event: 'order.created', statusCode: 200, isProcessed: true },
    { direction: 'OUTBOUND', event: 'customer.created', statusCode: 201, isProcessed: true },
    { direction: 'INBOUND', event: 'payment.captured', statusCode: 500, isProcessed: false },
    { direction: 'OUTBOUND', event: 'product.viewed', statusCode: 200, isProcessed: true },
    { direction: 'INBOUND', event: 'inventory.updated', statusCode: 202, isProcessed: true },
    { direction: 'OUTBOUND', event: 'payment.captured', statusCode: 200, isProcessed: true },
    { direction: 'INBOUND', event: 'ticket.created', statusCode: 503, isProcessed: false },
  ].entries()) {
    await seedRow(prisma, 'webhookLog', demoId('webhook-log', index + 1), {
      endpointId: endpoints[index % endpoints.length]?.id ?? null,
      direction: log.direction,
      provider: index % 2 === 0 ? 'RAZORPAY' : 'CUSTOM',
      event: log.event,
      eventId: demoId('event', index + 1),
      payload: { demo: true },
      signature: 'demo-signature',
      statusCode: log.statusCode,
      isProcessed: log.isProcessed,
      error: log.isProcessed ? '' : 'Upstream timeout',
      durationMs: 120 + index * 30,
      createdAt: daysFromNow(-index),
    });
  }
};

/** Adds bulk imports, dead-letter jobs and scheduled reports. */
const seedJobs = async (prisma: PrismaClient, identity: IdentityContext): Promise<void> => {
  for (const [index, job] of [
    { jobId: 'demo-bulk-1', type: 'PRODUCT_IMPORT', status: 'COMPLETED', totalRows: 50 },
    { jobId: 'demo-bulk-2', type: 'ORDER_IMPORT', status: 'RUNNING', totalRows: 120 },
    { jobId: 'demo-bulk-3', type: 'USER_IMPORT', status: 'FAILED', totalRows: 30 },
    { jobId: 'demo-bulk-4', type: 'PRODUCT_IMPORT', status: 'COMPLETED', totalRows: 75 },
    { jobId: 'demo-bulk-5', type: 'CUSTOMER_IMPORT', status: 'COMPLETED', totalRows: 45 },
    { jobId: 'demo-bulk-6', type: 'ORDER_IMPORT', status: 'FAILED', totalRows: 90 },
    { jobId: 'demo-bulk-7', type: 'PRODUCT_IMPORT', status: 'RUNNING', totalRows: 110 },
  ].entries()) {
    await seedRowBy(prisma, 'bulkJob', { jobId: job.jobId }, demoId('bulk-job', index + 1), {
      jobId: job.jobId,
      type: job.type,
      fileName: `${job.type.toLowerCase()}.csv`,
      fileUrl: `https://demo.local/bulk/${job.jobId}.csv`,
      totalRows: job.totalRows,
      successCount: index === 0 ? job.totalRows : index === 1 ? 70 : 10,
      failCount: index === 0 ? 0 : index === 1 ? 0 : 20,
      errors: index === 2 ? [{ row: 4, message: 'Invalid email' }] : [],
      status: job.status as any,
      vendorId: index === 0 ? identity.vendorIds.main : null,
      createdById: identity.superAdminId,
      startedAt: daysFromNow(-2),
      completedAt: index === 0 ? daysFromNow(-2) : null,
    });
  }

  for (const [index, job] of [
    { queue: 'email', jobName: 'send-email', jobId: 'demo-failed-1' },
    { queue: 'order', jobName: 'auto-cancel', jobId: 'demo-failed-2' },
    { queue: 'analytics', jobName: 'daily-rollup', jobId: 'demo-failed-3' },
    { queue: 'email', jobName: 'newsletter-campaign', jobId: 'demo-failed-4' },
    { queue: 'inventory', jobName: 'stock-alert', jobId: 'demo-failed-5' },
    { queue: 'webhook', jobName: 'partner-retry', jobId: 'demo-failed-6' },
    { queue: 'report', jobName: 'monthly-report', jobId: 'demo-failed-7' },
  ].entries()) {
    await prisma.failedJob.upsert({
      where: { queue_jobId: { queue: job.queue, jobId: job.jobId } },
      create: {
        ...job,
        payload: { demo: true },
        error: 'Demo failure for testing the dead-letter screen',
        attemptsMade: 3,
        status: index === 0 ? 'RESOLVED' : 'PENDING',
        lastErrorAt: daysFromNow(-index),
        resolvedAt: index === 0 ? daysFromNow(-1) : null,
        resolvedBy: index === 0 ? identity.superAdminId : null,
      },
      update: {},
    });
  }

  for (const [index, report] of [
    {
      name: 'Daily sales',
      reportType: 'SALES',
      cron: '0 6 * * *',
      recipients: ['ops@projectname.com'],
      format: 'CSV',
    },
    {
      name: 'Weekly payouts',
      reportType: 'PAYOUT',
      cron: '0 7 * * 1',
      recipients: ['finance@projectname.com'],
      format: 'XLSX',
    },
    {
      name: 'Monthly GST',
      reportType: 'TAX',
      cron: '0 8 1 * *',
      recipients: ['accounts@projectname.com'],
      format: 'PDF',
    },
    { name: 'Daily inventory', reportType: 'INVENTORY', cron: '0 5 * * *', recipients: ['warehouse@projectname.com'], format: 'CSV' },
    { name: 'Weekly customers', reportType: 'CUSTOMER', cron: '0 9 * * 1', recipients: ['growth@projectname.com'], format: 'XLSX' },
    { name: 'Weekly returns', reportType: 'RETURN', cron: '0 10 * * 1', recipients: ['support@projectname.com'], format: 'CSV' },
    { name: 'Monthly vendor summary', reportType: 'VENDOR', cron: '0 7 1 * *', recipients: ['vendors@projectname.com'], format: 'PDF' },
  ].entries()) {
    await seedRow(prisma, 'reportSchedule', demoId('report-schedule', index + 1), {
      ...report,
      isActive: true,
      lastRunAt: daysFromNow(-1 - index),
      nextRunAt: daysFromNow(1 + index),
      createdById: identity.superAdminId,
    });
  }
};

/** Adds search history so the search-analytics screens have rows. */
const seedSearches = async (prisma: PrismaClient, identity: IdentityContext): Promise<void> => {
  for (const [index, search] of [
    { term: 'cotton shirt', resultCount: 4, hasResults: true },
    { term: 'wireless headphones', resultCount: 2, hasResults: true },
    { term: 'running shoes', resultCount: 0, hasResults: false },
    { term: 'smart watch', resultCount: 3, hasResults: true },
    { term: 'cotton t shirt', resultCount: 5, hasResults: true },
    { term: 'fitness tracker', resultCount: 2, hasResults: true },
    { term: 'water bottle', resultCount: 0, hasResults: false },
  ].entries()) {
    await seedRow(prisma, 'searchLog', demoId('search-log', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      sessionKey: `demo-session-${(index % 4) + 1}`,
      term: search.term,
      resultCount: search.resultCount,
      hasResults: search.hasResults,
      filters: { sort: 'relevance' },
      createdAt: daysFromNow(-index),
    });
  }
};

/** Seeds every operations row. */
export const seedOpsModule = async (
  prisma: PrismaClient,
  identity: IdentityContext,
): Promise<void> => {
  await seedLogs(prisma, identity);
  await seedIntegrations(prisma, identity);
  await seedJobs(prisma, identity);
  await seedSearches(prisma, identity);

  // eslint-disable-next-line no-console
  console.log('[seed]   ops (audit, activity, webhooks, bulk jobs, failed jobs, search) — done');
};
