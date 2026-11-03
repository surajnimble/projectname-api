/**
 * Local-only demo data for every model the API exposes.
 *
 * `npm run seed` calls this after the base seed, so a development database has
 * at least three rows in every table and no screen opens on an empty state. It
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

  void geo;
  return countDemoRows(prisma);
};
