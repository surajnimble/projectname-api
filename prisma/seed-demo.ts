/**
 * Local-only demo data for every model the API exposes.
 *
 * `npm run seed` calls this after the base seed, so a development database has
 * at least seven rows in every primary admin list resource so screens have useful dummy data. It
 * never runs in production and can be turned off with `SEED_DEMO_DATA=false`.
 */
import { PrismaClient } from '@prisma/client';
import { seedGeo } from './demo/geo';
import { seedIdentity } from './demo/identity';
import { seedCatalog } from './demo/catalog';
import { seedCommerce } from './demo/commerce';
import { seedEngagementModule } from './demo/engagement';
import { seedContentModule } from './demo/content';
import { seedOpsModule } from './demo/ops';
import { seedAnalyticsModule } from './demo/analytics';

/** True when the current process may write demo data. */
export const isDemoSeedEnabled = (): boolean =>
  process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA !== 'false';

/** Row counts reported by `npm run seed` once the demo seed finishes. */
export interface DemoSummary {
  users: number;
  vendors: number;
  deliveryBoys: number;
  products: number;
  orders: number;
  payments: number;
  returns: number;
  tickets: number;
  notifications: number;
  coupons: number;
  blogs: number;
}

const countDemoRows = async (prisma: PrismaClient): Promise<DemoSummary> => {
  const users = await prisma.user.count();
  const vendors = await prisma.vendorProfile.count();
  const deliveryBoys = await prisma.deliveryBoy.count();
  const products = await prisma.product.count();
  const orders = await prisma.order.count();
  const payments = await prisma.payment.count();
  const returns = await prisma.returnRequest.count();
  const tickets = await prisma.ticket.count();
  const notifications = await prisma.notification.count();
  const coupons = await prisma.coupon.count();
  const blogs = await prisma.blog.count();

  return {
    users,
    vendors,
    deliveryBoys,
    products,
    orders,
    payments,
    returns,
    tickets,
    notifications,
    coupons,
    blogs,
  };
};


/** Fail the demo seed if a primary admin list would still be empty or too thin. */
const assertMinimumListRows = async (prisma: PrismaClient): Promise<void> => {
  const required: Array<{ label: string; count: () => Promise<number> }> = [
    { label: 'customers', count: () => prisma.user.count({ where: { role: 'CUSTOMER' } }) },
    { label: 'sub admins', count: () => prisma.user.count({ where: { role: 'SUB_ADMIN' } }) },
    { label: 'vendors', count: () => prisma.vendorProfile.count() },
    { label: 'delivery partners', count: () => prisma.deliveryBoy.count() },
    { label: 'categories', count: () => prisma.category.count() },
    { label: 'brands', count: () => prisma.brand.count() },
    { label: 'tags', count: () => prisma.tag.count() },
    { label: 'attributes', count: () => prisma.attribute.count() },
    { label: 'products', count: () => prisma.product.count() },
    { label: 'collections', count: () => prisma.collection.count() },
    { label: 'orders', count: () => prisma.order.count() },
    { label: 'sub orders', count: () => prisma.subOrder.count() },
    { label: 'payments', count: () => prisma.payment.count() },
    { label: 'refunds', count: () => prisma.refund.count() },
    { label: 'payouts', count: () => prisma.payout.count() },
    { label: 'returns', count: () => prisma.returnRequest.count() },
    { label: 'reviews', count: () => prisma.review.count() },
    { label: 'product questions', count: () => prisma.question.count() },
    { label: 'coupons', count: () => prisma.coupon.count() },
    { label: 'coupon usages', count: () => prisma.couponUsage.count() },
    { label: 'flash sales', count: () => prisma.flashSale.count() },
    { label: 'banners', count: () => prisma.banner.count() },
    { label: 'wallet transactions', count: () => prisma.walletTransaction.count() },
    { label: 'loyalty transactions', count: () => prisma.loyaltyTransaction.count() },
    { label: 'referrals', count: () => prisma.referral.count() },
    { label: 'gift cards', count: () => prisma.giftCard.count() },
    { label: 'notifications', count: () => prisma.notification.count() },
    { label: 'conversations', count: () => prisma.conversation.count() },
    { label: 'support tickets', count: () => prisma.ticket.count() },
    { label: 'customer notes', count: () => prisma.customerNote.count() },
    { label: 'content pages', count: () => prisma.page.count() },
    { label: 'blogs', count: () => prisma.blog.count() },
    { label: 'FAQs', count: () => prisma.faq.count() },
    { label: 'contact submissions', count: () => prisma.contactSubmission.count() },
    { label: 'newsletter subscribers', count: () => prisma.newsletterSubscriber.count() },
    { label: 'currencies', count: () => prisma.currency.count() },
    { label: 'tax configurations', count: () => prisma.taxConfig.count() },
    { label: 'countries', count: () => prisma.country.count() },
    { label: 'states', count: () => prisma.state.count() },
    { label: 'cities', count: () => prisma.city.count() },
    { label: 'shipping zones', count: () => prisma.shippingZone.count() },
    { label: 'shipping methods', count: () => prisma.shippingMethod.count() },
    { label: 'shipping partners', count: () => prisma.shippingPartner.count() },
    { label: 'audit logs', count: () => prisma.auditLog.count() },
    { label: 'activity logs', count: () => prisma.activityLog.count() },
    { label: 'API keys', count: () => prisma.apiKey.count() },
    { label: 'webhook endpoints', count: () => prisma.webhookEndpoint.count() },
    { label: 'webhook logs', count: () => prisma.webhookLog.count() },
    { label: 'bulk jobs', count: () => prisma.bulkJob.count() },
    { label: 'failed jobs', count: () => prisma.failedJob.count() },
    { label: 'scheduled reports', count: () => prisma.reportSchedule.count() },
    { label: 'search logs', count: () => prisma.searchLog.count() },
    { label: 'visitor events', count: () => prisma.visitorLog.count() },
    { label: 'page views', count: () => prisma.pageView.count() },
    { label: 'custom events', count: () => prisma.event.count() },
    { label: 'crash logs', count: () => prisma.crashLog.count() },
    { label: 'funnels', count: () => prisma.funnel.count() },
    { label: 'daily analytics', count: () => prisma.analyticsDaily.count() },
    { label: 'geo visits', count: () => prisma.geoVisit.count() },
  ];

  const results = await Promise.all(required.map(async (item) => ({ label: item.label, count: await item.count() })));
  const deficient = results.filter((item) => item.count < 7);
  if (deficient.length) {
    throw new Error(
      `[seed] Demo seed invariant failed. These list resources have fewer than 7 rows: ${deficient.map((item) => `${item.label}=${item.count}`).join(', ')}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`[seed] verified ${results.length} list resources contain at least 7 rows`);
};

/**
 * Seeds every demo module in dependency order.
 *
 * Geo and identity come first because every later row hangs off a shipping
 * method, a user or a vendor; commerce comes last because orders need products
 * and review writers.
 */
export const seedDemoContent = async (
  prisma: PrismaClient,
  superAdminId: string,
): Promise<DemoSummary> => {
  const geo = await seedGeo(prisma);
  // eslint-disable-next-line no-console
  console.log('[seed] geo — done');
  const identity = await seedIdentity(prisma, superAdminId);
  // eslint-disable-next-line no-console
  console.log('[seed] identity — done');
  const catalog = await seedCatalog(prisma, identity);
  // eslint-disable-next-line no-console
  console.log('[seed] catalog — done');
  const commerce = await seedCommerce(prisma, identity, catalog);
  // eslint-disable-next-line no-console
  console.log('[seed] commerce — done');

  await seedEngagementModule(prisma, identity, catalog, commerce);
  // eslint-disable-next-line no-console
  console.log('[seed] engagement (notifications, chat, tickets, wallet, loyalty) — done');
  await seedContentModule(prisma, identity, superAdminId);
  // eslint-disable-next-line no-console
  console.log('[seed] content (pages, blogs, faqs, contact, newsletter) — done');
  await seedOpsModule(prisma, identity);
  // eslint-disable-next-line no-console
  console.log('[seed] ops (audit, activity, webhooks, jobs, search) — done');
  await seedAnalyticsModule(prisma, identity);
  // eslint-disable-next-line no-console
  console.log('[seed] analytics (tracking, funnels, rollups) — done');

  await assertMinimumListRows(prisma);
  void geo;
  return countDemoRows(prisma);
};
