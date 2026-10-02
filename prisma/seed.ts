/**
 * Idempotent seed.
 *
 * Upserts (never `create`) so re-running never overwrites admin-tweaked values
 * except where explicitly intended. Creates the SUPER_ADMIN account and a set of
 * demo records so a fresh environment is usable in one command.
 *
 * Run: `npm run seed`  (or automatically via `prisma migrate reset`)
 */
// Loads .env before Prisma reads DATABASE_URL — the seed runs standalone, so it
// cannot rely on the app's import chain having loaded it already.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import slugify from 'slugify';

const prisma = new PrismaClient();

interface SettingSeed {
  key: string;
  value: any;
  category: string;
  isPublic: boolean;
}

const SETTINGS: SettingSeed[] = [
  // ── General / Site ──────────────────────────────────────────────────────
  { key: 'site.name', value: 'ProjectName', category: 'general', isPublic: true },
  { key: 'site.logo', value: '', category: 'general', isPublic: true },
  { key: 'site.supportEmail', value: 'support@projectname.com', category: 'general', isPublic: true },
  { key: 'site.supportPhones', value: [], category: 'general', isPublic: true },
  { key: 'site.favicon', value: '', category: 'general', isPublic: true },
  { key: 'site.tagline', value: '', category: 'general', isPublic: true },
  { key: 'site.addressLine', value: '', category: 'general', isPublic: true },
  {
    key: 'site.socialLinks',
    value: { facebook: '', instagram: '', twitter: '', youtube: '' },
    category: 'general',
    isPublic: true,
  },
  { key: 'site.maintenanceImage', value: '', category: 'general', isPublic: true },

  // ── Locale / Timezone / Currency ────────────────────────────────────────
  { key: 'currency.code', value: 'INR', category: 'currency', isPublic: true },
  { key: 'currency.symbol', value: '₹', category: 'currency', isPublic: true },
  { key: 'currency.decimals', value: 2, category: 'currency', isPublic: true },
  { key: 'locale.default', value: 'en', category: 'locale', isPublic: true },
  { key: 'locale.supported', value: ['en', 'hi'], category: 'locale', isPublic: true },
  { key: 'timezone.default', value: 'Asia/Kolkata', category: 'locale', isPublic: true },
  { key: 'date.format', value: 'DD-MM-YYYY', category: 'locale', isPublic: true },
  { key: 'time.format', value: 'hh:mm A', category: 'locale', isPublic: true },

  // ── Business / Commission ───────────────────────────────────────────────
  { key: 'commission.default', value: 10, category: 'business', isPublic: false },
  { key: 'commission.minPercent', value: 0, category: 'business', isPublic: false },
  { key: 'commission.maxPercent', value: 50, category: 'business', isPublic: false },
  { key: 'tax.defaultGstPercent', value: 18, category: 'tax', isPublic: true },
  { key: 'tax.inclusive', value: false, category: 'tax', isPublic: true },

  // ── Order ───────────────────────────────────────────────────────────────
  { key: 'order.minAmount', value: 100, category: 'business', isPublic: true },
  { key: 'order.maxItems', value: 50, category: 'business', isPublic: true },
  { key: 'order.cancelWindowMin', value: 30, category: 'business', isPublic: true },
  { key: 'order.autoCancelUnpaidMin', value: 1440, category: 'order', isPublic: false },
  { key: 'order.allowGuestCheckout', value: false, category: 'order', isPublic: true },
  { key: 'order.requirePhoneVerify', value: true, category: 'order', isPublic: true },
  { key: 'order.maxPerCustomerPerDay', value: 20, category: 'order', isPublic: false },
  { key: 'order.showVendorSplit', value: true, category: 'order', isPublic: true },

  // ── Payment — COD / UPI / Bank ──────────────────────────────────────────
  { key: 'payment.cod.enabled', value: true, category: 'payment', isPublic: true },
  { key: 'payment.upi.enabled', value: true, category: 'payment', isPublic: true },
  { key: 'payment.bank.enabled', value: true, category: 'payment', isPublic: true },
  { key: 'payment.upi.id', value: 'projectname@upi', category: 'payment', isPublic: true },
  { key: 'payment.bank.holderName', value: 'ProjectName Pvt Ltd', category: 'payment', isPublic: true },
  { key: 'payment.bank.accountNo', value: '000000000000', category: 'payment', isPublic: true },
  { key: 'payment.bank.ifsc', value: 'HDFC0000000', category: 'payment', isPublic: true },
  { key: 'payment.cod.maxAmount', value: 20000, category: 'payment', isPublic: true },
  { key: 'payment.cod.enabledAbove', value: 0, category: 'payment', isPublic: true },
  { key: 'payment.cod.extraCharge', value: 0, category: 'payment', isPublic: true },
  { key: 'payment.razorpay.enabled', value: false, category: 'payment', isPublic: false },
  { key: 'payment.razorpay.keyId', value: '', category: 'payment', isPublic: false },
  { key: 'payment.razorpay.webhookSecret', value: '', category: 'payment', isPublic: false },

  // ── Payment — Token / Advance ───────────────────────────────────────────
  { key: 'payment.token.enabled', value: false, category: 'payment', isPublic: true },
  { key: 'payment.token.mode', value: 'percent', category: 'payment', isPublic: true },
  { key: 'payment.token.percent', value: 20, category: 'payment', isPublic: true },
  { key: 'payment.token.fixedAmount', value: 100, category: 'payment', isPublic: true },
  { key: 'payment.token.minAmount', value: 50, category: 'payment', isPublic: true },
  { key: 'payment.token.maxAmount', value: 5000, category: 'payment', isPublic: true },
  { key: 'payment.token.applicableAbove', value: 2000, category: 'payment', isPublic: true },
  {
    key: 'payment.token.allowedMethods',
    value: ['UPI', 'CARD', 'NETBANKING'],
    category: 'payment',
    isPublic: true,
  },
  { key: 'payment.token.refundable', value: true, category: 'payment', isPublic: true },
  { key: 'payment.token.refundPercent', value: 100, category: 'payment', isPublic: true },
  { key: 'payment.token.cancelWindowMin', value: 60, category: 'payment', isPublic: true },
  { key: 'payment.token.balanceDueDays', value: 7, category: 'payment', isPublic: true },
  {
    key: 'payment.token.balanceReminderHours',
    value: [24, 48, 72],
    category: 'payment',
    isPublic: false,
  },
  { key: 'payment.token.forfeitOnNoPay', value: true, category: 'payment', isPublic: false },
  { key: 'payment.token.autoCancelAfterDue', value: true, category: 'payment', isPublic: false },

  // ── Shipping / Delivery ─────────────────────────────────────────────────
  { key: 'shipping.enabled', value: true, category: 'shipping', isPublic: true },
  { key: 'shipping.defaultCharge', value: 49, category: 'shipping', isPublic: true },
  { key: 'shipping.freeAbove', value: 999, category: 'shipping', isPublic: true },
  { key: 'shipping.estimatedDays', value: 5, category: 'shipping', isPublic: true },
  { key: 'shipping.perKgCharge', value: 0, category: 'shipping', isPublic: true },
  { key: 'shipping.maxDistanceKm', value: 0, category: 'shipping', isPublic: true },
  { key: 'shipping.serviceablePincodes', value: [], category: 'shipping', isPublic: true },

  // ── Return / Refund ─────────────────────────────────────────────────────
  { key: 'return.enabled', value: true, category: 'return', isPublic: true },
  { key: 'return.windowDays', value: 7, category: 'return', isPublic: true },
  { key: 'return.reasonRequired', value: true, category: 'return', isPublic: true },
  { key: 'return.imagesRequired', value: true, category: 'return', isPublic: true },
  { key: 'return.maxQtyPerOrder', value: 0, category: 'return', isPublic: false },
  { key: 'refund.processingDays', value: 5, category: 'refund', isPublic: true },
  { key: 'refund.mode', value: 'original', category: 'refund', isPublic: true },

  // ── Wallet / Loyalty ────────────────────────────────────────────────────
  { key: 'wallet.enabled', value: false, category: 'wallet', isPublic: true },
  { key: 'wallet.maxBalance', value: 50000, category: 'wallet', isPublic: true },
  { key: 'wallet.minRedeem', value: 100, category: 'wallet', isPublic: true },
  { key: 'wallet.expiryDays', value: 365, category: 'wallet', isPublic: true },
  { key: 'loyalty.enabled', value: false, category: 'loyalty', isPublic: true },
  { key: 'loyalty.pointsPerRupee', value: 1, category: 'loyalty', isPublic: true },
  { key: 'loyalty.pointValue', value: 0.01, category: 'loyalty', isPublic: true },
  { key: 'loyalty.minRedeemPoints', value: 100, category: 'loyalty', isPublic: true },

  // ── Coupon ──────────────────────────────────────────────────────────────
  { key: 'coupon.maxPerOrder', value: 1, category: 'coupon', isPublic: true },
  { key: 'coupon.stackable', value: false, category: 'coupon', isPublic: true },
  { key: 'coupon.minOrderAmount', value: 0, category: 'coupon', isPublic: true },
  { key: 'coupon.maxDiscount', value: 0, category: 'coupon', isPublic: true },

  // ── Features ────────────────────────────────────────────────────────────
  { key: 'feature.reviews', value: true, category: 'feature', isPublic: true },
  { key: 'feature.wishlist', value: true, category: 'feature', isPublic: true },
  { key: 'feature.coupons', value: true, category: 'feature', isPublic: true },
  { key: 'feature.chat', value: false, category: 'feature', isPublic: true },
  { key: 'feature.multiVendor', value: true, category: 'feature', isPublic: true },
  { key: 'feature.guestCheckout', value: false, category: 'feature', isPublic: true },
  { key: 'feature.productCompare', value: false, category: 'feature', isPublic: true },
  { key: 'feature.recentlyViewed', value: true, category: 'feature', isPublic: true },
  { key: 'feature.liveTracking', value: false, category: 'feature', isPublic: true },
  { key: 'feature.wallet', value: false, category: 'feature', isPublic: true },
  { key: 'feature.loyalty', value: false, category: 'feature', isPublic: true },
  { key: 'feature.referral', value: false, category: 'feature', isPublic: true },
  { key: 'feature.giftCards', value: false, category: 'feature', isPublic: true },
  { key: 'feature.chatSupport', value: false, category: 'feature', isPublic: true },
  { key: 'feature.ticketSupport', value: true, category: 'feature', isPublic: true },
  { key: 'feature.socialLogin', value: true, category: 'feature', isPublic: true },
  { key: 'feature.twoFactor', value: false, category: 'feature', isPublic: true },
  { key: 'feature.analytics', value: true, category: 'feature', isPublic: true },
  { key: 'feature.tracking', value: true, category: 'feature', isPublic: true },

  // ── Catalog ─────────────────────────────────────────────────────────────
  { key: 'catalog.productsPerPage', value: 20, category: 'catalog', isPublic: true },
  { key: 'catalog.showOutOfStock', value: true, category: 'catalog', isPublic: true },
  { key: 'catalog.allowBackorder', value: false, category: 'catalog', isPublic: true },
  { key: 'catalog.defaultSort', value: '-createdAt', category: 'catalog', isPublic: true },
  { key: 'catalog.maxImagesPerProduct', value: 10, category: 'catalog', isPublic: false },

  // ── Cart ────────────────────────────────────────────────────────────────
  { key: 'cart.maxItems', value: 50, category: 'cart', isPublic: true },
  { key: 'cart.holdMinutes', value: 30, category: 'cart', isPublic: false },
  { key: 'cart.persistAcrossDevices', value: true, category: 'cart', isPublic: true },

  // ── Vendor / Payout ─────────────────────────────────────────────────────
  { key: 'vendor.autoApprove', value: false, category: 'vendor', isPublic: false },
  { key: 'vendor.maxProducts', value: 500, category: 'vendor', isPublic: false },
  { key: 'vendor.minPayoutAmount', value: 500, category: 'vendor', isPublic: false },
  { key: 'vendor.payoutCycleDays', value: 7, category: 'vendor', isPublic: false },
  { key: 'vendor.payoutHoldDays', value: 3, category: 'vendor', isPublic: false },
  { key: 'vendor.commissionOverrideAllowed', value: true, category: 'vendor', isPublic: false },

  // ── Notification ────────────────────────────────────────────────────────
  { key: 'notification.email.enabled', value: true, category: 'notification', isPublic: false },
  { key: 'notification.sms.enabled', value: false, category: 'notification', isPublic: false },
  { key: 'notification.push.enabled', value: true, category: 'notification', isPublic: false },
  { key: 'notification.whatsapp.enabled', value: false, category: 'notification', isPublic: false },
  {
    key: 'notification.orderEvents',
    value: ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    category: 'notification',
    isPublic: false,
  },
  {
    key: 'notification.tokenBalanceReminder',
    value: true,
    category: 'notification',
    isPublic: false,
  },

  // ── Security ────────────────────────────────────────────────────────────
  { key: 'security.otpLoginEnabled', value: false, category: 'security', isPublic: false },
  { key: 'security.twoFactorEnabled', value: false, category: 'security', isPublic: false },
  { key: 'security.maxLoginAttempts', value: 5, category: 'security', isPublic: false },
  { key: 'security.lockoutMinutes', value: 15, category: 'security', isPublic: false },
  { key: 'security.passwordMinLength', value: 8, category: 'security', isPublic: false },
  { key: 'security.requireEmailVerify', value: false, category: 'security', isPublic: false },
  { key: 'security.requirePhoneVerify', value: true, category: 'security', isPublic: false },
  { key: 'security.sessionDays', value: 7, category: 'security', isPublic: false },

  // ── System / Maintenance ────────────────────────────────────────────────
  { key: 'maintenance.enabled', value: false, category: 'system', isPublic: false },
  { key: 'maintenance.message', value: "We'll be back soon.", category: 'system', isPublic: true },
  { key: 'maintenance.allowedIps', value: [], category: 'system', isPublic: false },
  { key: 'system.encryptionEnabled', value: false, category: 'system', isPublic: false },
  { key: 'system.apiRateLimitPerMin', value: 100, category: 'system', isPublic: false },

  // ── App / Android / iOS ─────────────────────────────────────────────────
  { key: 'app.minAndroidVersion', value: '1.0.0', category: 'app', isPublic: true },
  { key: 'app.forceUpdateAndroid', value: false, category: 'app', isPublic: true },
  { key: 'app.latestAndroidVersion', value: '1.0.0', category: 'app', isPublic: true },
  { key: 'app.minIosVersion', value: '1.0.0', category: 'app', isPublic: true },
  { key: 'app.forceUpdateIos', value: false, category: 'app', isPublic: true },
  { key: 'app.latestIosVersion', value: '1.0.0', category: 'app', isPublic: true },
  { key: 'app.updateMessage', value: '', category: 'app', isPublic: true },

  // ── Tracking & Analytics ────────────────────────────────────────────────
  { key: 'tracking.enabled', value: true, category: 'tracking', isPublic: false },
  { key: 'tracking.sessionTimeoutMin', value: 30, category: 'tracking', isPublic: false },
  { key: 'tracking.geoLookupEnabled', value: true, category: 'tracking', isPublic: false },
  { key: 'tracking.botFilterEnabled', value: true, category: 'tracking', isPublic: false },
  { key: 'tracking.rawRetentionDays', value: 90, category: 'tracking', isPublic: false },
  { key: 'analytics.realtimeWindowMin', value: 5, category: 'analytics', isPublic: false },
  { key: 'analytics.aggregationCron', value: '0 2 * * *', category: 'analytics', isPublic: false },
  { key: 'analytics.exportMaxRows', value: 50000, category: 'analytics', isPublic: false },

  // ── Referral / Gift Cards ───────────────────────────────────────────────
  { key: 'referral.enabled', value: false, category: 'referral', isPublic: true },
  { key: 'referral.referrerReward', value: 100, category: 'referral', isPublic: false },
  { key: 'referral.refereeReward', value: 50, category: 'referral', isPublic: false },
  { key: 'referral.expiryDays', value: 90, category: 'referral', isPublic: false },
  { key: 'giftCard.enabled', value: false, category: 'giftCard', isPublic: true },
  { key: 'giftCard.minAmount', value: 100, category: 'giftCard', isPublic: true },
  { key: 'giftCard.maxAmount', value: 50000, category: 'giftCard', isPublic: true },
  { key: 'giftCard.expiryDays', value: 365, category: 'giftCard', isPublic: true },

  // ── Support / Chat ──────────────────────────────────────────────────────
  { key: 'support.ticket.enabled', value: true, category: 'support', isPublic: true },
  { key: 'support.chat.enabled', value: false, category: 'support', isPublic: true },
  { key: 'support.chatAutoReply', value: true, category: 'support', isPublic: false },
  {
    key: 'support.workingHours',
    value: { start: '10:00', end: '19:00' },
    category: 'support',
    isPublic: true,
  },
];

/** Code-level permission defaults mirrored into RolePermission. */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  SUB_ADMIN: [
    'dashboard:view',
    'settings:view',
    'user:list',
    'user:view',
    'user:suspend',
    'vendor:list',
    'vendor:view',
    'vendor:approve',
    'vendor:reject',
    'vendor:suspend',
    'vendor:kyc:verify',
    'category:manage',
    'brand:manage',
    'tag:manage',
    'attribute:manage',
    'collection:manage',
    'product:view:all',
    'order:list',
    'order:view',
    'order:status:update',
    'order:delivery:assign',
    'return:list',
    'return:approve',
    'return:reject',
    'payment:list',
    'payment:confirm',
    'payout:list',
    'payout:approve',
    'payout:reject',
    'payout:generate',
    'coupon:manage',
    'flashsale:manage',
    'banner:manage',
    'review:moderate',
    'question:moderate',
    'page:manage',
    'blog:manage',
    'faq:manage',
    'content:view',
    'ticket:list',
    'ticket:reply',
    'ticket:assign',
    'contact:view',
    'newsletter:manage',
    'notification:send',
    'analytics:view',
    'analytics:export',
    'report:view',
    'report:export',
    'device:view',
    'tracking:view',
    'auditlog:view',
    'activitylog:view',
    'bulk:import',
    'shipping:manage',
    'deliveryboy:manage',
  ],
  VENDOR: [
    'product:create',
    'product:update',
    'product:delete',
    'order:list',
    'order:view',
    'return:list',
    'return:approve',
    'return:reject',
    'review:moderate',
    'question:moderate',
    'ticket:list',
    'ticket:reply',
    'chat:view',
    'report:view',
    'vendor:view',
  ],
  CUSTOMER: [],
  DELIVERY_BOY: [],
};

const toSlug = (value: string): string =>
  slugify(value, { lower: true, strict: true, trim: true, replacement: '-' });

const uniqueSlug = async (base: string, exists: (slug: string) => Promise<boolean>): Promise<string> => {
  const root = toSlug(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i <= 50; i += 1) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
};

const seedSettings = async (): Promise<number> => {
  for (const setting of SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      create: {
        key: setting.key,
        value: setting.value as any,
        category: setting.category,
        isPublic: setting.isPublic,
      },
      // Preserve admin overrides: only fill a row that does not exist yet.
      update: { category: setting.category },
    });
  }
  return SETTINGS.length;
};

const seedRolePermissions = async (): Promise<number> => {
  let count = 0;
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { role_permission: { role: role as any, permission } },
        create: { role: role as any, permission, isAllowed: true },
        update: {},
      });
      count += 1;
    }
  }
  return count;
};

const seedSuperAdmin = async (): Promise<string> => {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@projectname.com').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecret@123';

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Super Admin',
      phone: '',
      passwordHash: await bcrypt.hash(password, 12),
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
    select: { id: true },
  });

  // eslint-disable-next-line no-console
  console.log(`[seed] SUPER_ADMIN ready -> ${email}`);

  return user.id;
};

const seedDemoData = async (superAdminId: string): Promise<void> => {
  const demoEnabled = process.env.SEED_DEMO_DATA !== 'false';

  // ── Countries / States ───────────────────────────────────────────────────
  const india = await prisma.country.upsert({
    where: { code: 'IN' },
    create: { code: 'IN', name: 'India', dialCode: '+91', currency: 'INR' },
    update: {},
  });

  const demoStates = [
    { code: 'DL', name: 'Delhi' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'GJ', name: 'Gujarat' },
  ];

  for (const state of demoStates) {
    await prisma.state.upsert({
      where: { code: state.code },
      create: { countryCode: india.code, code: state.code, name: state.name },
      update: {},
    });
  }

  const demoCities = [
    { stateCode: 'DL', name: 'New Delhi', pincode: '110001' },
    { stateCode: 'MH', name: 'Mumbai', pincode: '400001' },
    { stateCode: 'KA', name: 'Bengaluru', pincode: '560001' },
    { stateCode: 'UP', name: 'Lucknow', pincode: '226001' },
    { stateCode: 'TN', name: 'Chennai', pincode: '600001' },
    { stateCode: 'GJ', name: 'Ahmedabad', pincode: '380001' },
  ];

  for (const city of demoCities) {
    const existing = await prisma.city.findFirst({
      where: { stateCode: city.stateCode, name: city.name },
      select: { id: true },
    });
    if (!existing) {
      await prisma.city.create({ data: city });
    }
  }

  // ── Currency / Tax / Dropdown / Translation ─────────────────────────────
  await prisma.currency.upsert({
    where: { code: 'INR' },
    create: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, rate: 1, isDefault: true },
    update: {},
  });

  const taxConfigs = [
    { name: 'GST 18%', slug: 'gst-18', percent: 18, cgstPercent: 9, sgstPercent: 9, igstPercent: 18 },
    { name: 'GST 12%', slug: 'gst-12', percent: 12, cgstPercent: 6, sgstPercent: 6, igstPercent: 12 },
    { name: 'GST 5%', slug: 'gst-5', percent: 5, cgstPercent: 2.5, sgstPercent: 2.5, igstPercent: 5 },
  ];

  for (const tax of taxConfigs) {
    await prisma.taxConfig.upsert({ where: { slug: tax.slug }, create: tax, update: {} });
  }

  const dropdowns = [
    { type: 'INDUSTRY', label: 'Fashion', value: 'fashion' },
    { type: 'INDUSTRY', label: 'Electronics', value: 'electronics' },
    { type: 'INDUSTRY', label: 'Grocery', value: 'grocery' },
    { type: 'INDUSTRY', label: 'Home & Kitchen', value: 'home-kitchen' },
    { type: 'INDUSTRY', label: 'Beauty', value: 'beauty' },
    { type: 'PRODUCT_TYPE', label: 'Physical', value: 'physical' },
    { type: 'PRODUCT_TYPE', label: 'Digital', value: 'digital' },
    { type: 'TITLE', label: 'Mr', value: 'mr' },
    { type: 'TITLE', label: 'Mrs', value: 'mrs' },
    { type: 'TITLE', label: 'Ms', value: 'ms' },
    { type: 'TITLE', label: 'Dr', value: 'dr' },
  ];

  for (const dropdown of dropdowns) {
    await prisma.dropdown.upsert({
      where: { type_value: { type: dropdown.type, value: dropdown.value } },
      create: dropdown,
      update: {},
    });
  }

  const translations: Record<string, Record<string, string>> = {
    en: {
      'app.name': 'ProjectName',
      'cart.empty': 'Your cart is empty.',
      'order.placed': 'Order placed successfully.',
      'checkout.title': 'Checkout',
    },
    hi: {
      'app.name': 'प्रोजेक्टनेम',
      'cart.empty': 'आपकी कार्ट खाली है।',
      'order.placed': 'ऑर्डर सफलतापूर्वक दिया गया।',
      'checkout.title': 'चेकआउट',
    },
  };

  for (const [locale, entries] of Object.entries(translations)) {
    for (const [key, value] of Object.entries(entries)) {
      await prisma.translation.upsert({
        where: { locale_key_namespace: { locale, key, namespace: 'common' } },
        create: { locale, key, value, namespace: 'common' },
        update: {},
      });
    }
  }

  // ── Categories / Brands / Tags / Attributes / Collection ─────────────────
  const categorySeeds = [
    { name: 'Men', slug: 'men', parentId: null, sortOrder: 1 },
    { name: 'Women', slug: 'women', parentId: null, sortOrder: 2 },
    { name: 'Electronics', slug: 'electronics', parentId: null, sortOrder: 3 },
    { name: 'Home & Kitchen', slug: 'home-kitchen', parentId: null, sortOrder: 4 },
  ];

  for (const category of categorySeeds) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, description: `${category.name} products`, isActive: true },
      update: {},
    });
  }

  const menId = (await prisma.category.findUnique({ where: { slug: 'men' }, select: { id: true } }))!.id;

  const subCategories = [
    { name: 'Shirts', slug: 'shirts', parentId: menId, sortOrder: 1 },
    { name: 'Trousers', slug: 'trousers', parentId: menId, sortOrder: 2 },
    { name: 'T-Shirts', slug: 't-shirts', parentId: menId, sortOrder: 3 },
  ];

  for (const category of subCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, isActive: true },
      update: {},
    });
  }

  for (const brand of [
    { name: 'ProjectName Basics', slug: 'projectname-basics' },
    { name: 'Urban Threads', slug: 'urban-threads' },
    { name: 'TechNova', slug: 'technova' },
  ]) {
    await prisma.brand.upsert({ where: { slug: brand.slug }, create: brand, update: {} });
  }

  for (const tag of [{ name: 'new-arrival', slug: 'new-arrival' }, { name: 'sale', slug: 'sale' }]) {
    await prisma.tag.upsert({ where: { slug: tag.slug }, create: tag, update: {} });
  }

  for (const attribute of [
    { name: 'Size', slug: 'size', type: 'SIZE' as const, options: ['S', 'M', 'L', 'XL'], isVariant: true },
    { name: 'Colour', slug: 'colour', type: 'COLOR' as const, options: ['Black', 'White', 'Blue'], isVariant: true },
    { name: 'Material', slug: 'material', type: 'SELECT' as const, options: ['Cotton', 'Polyester'] },
  ]) {
    await prisma.attribute.upsert({
      where: { slug: attribute.slug },
      create: { ...attribute, isFilterable: true, isActive: true },
      update: {},
    });
  }

  await prisma.collection.upsert({
    where: { slug: 'featured' },
    create: { name: 'Featured', slug: 'featured', type: 'MANUAL', description: 'Curated picks', isActive: true },
    update: {},
  });

  // ── Return reasons / Ticket categories ───────────────────────────────────
  const returnReasons = [
    { title: 'Wrong size', slug: 'wrong-size' },
    { title: 'Damaged product', slug: 'damaged-product' },
    { title: 'Defective product', slug: 'defective-product' },
    { title: 'Changed mind', slug: 'changed-mind' },
    { title: 'Not as described', slug: 'not-as-described' },
  ];

  for (const reason of returnReasons) {
    await prisma.returnReason.upsert({
      where: { slug: reason.slug },
      create: reason,
      update: {},
    });
  }

  for (const category of [
    { name: 'Order Issue', slug: 'order-issue' },
    { name: 'Payment Issue', slug: 'payment-issue' },
    { name: 'Return / Refund', slug: 'return-refund' },
    { name: 'Account Issue', slug: 'account-issue' },
    { name: 'Other', slug: 'other' },
  ]) {
    await prisma.ticketCategory.upsert({ where: { slug: category.slug }, create: category, update: {} });
  }

  // ── Shipping ─────────────────────────────────────────────────────────────
  await prisma.shippingZone.upsert({
    where: { id: 'seed-zone-india' },
    create: {
      id: 'seed-zone-india',
      name: 'India',
      countries: ['IN'],
      states: ['DL', 'MH', 'KA', 'UP', 'TN', 'GJ'],
      pincodes: [],
      isActive: true,
    },
    update: {},
  });

  const zone = await prisma.shippingZone.findUnique({ where: { id: 'seed-zone-india' } });

  const shippingMethods = [
    { name: 'Standard', code: 'STANDARD', baseCharge: 49, minDays: 3, maxDays: 6, freeAbove: 999 },
    { name: 'Express', code: 'EXPRESS', baseCharge: 99, minDays: 1, maxDays: 3, freeAbove: 1999 },
  ];

  for (const method of shippingMethods) {
    await prisma.shippingMethod.upsert({
      where: { code: method.code },
      create: { ...method, zoneId: zone?.id, isCodAllowed: true, isActive: true },
      update: {},
    });
  }

  await prisma.shippingPartner.upsert({
    where: { code: 'manual' },
    create: { name: 'Manual / Self Shipped', code: 'manual', isActive: true },
    update: {},
  });

  // ── Demo accounts ────────────────────────────────────────────────────────
  const demoPassword = await bcrypt.hash('Demo@12345', 12);

  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@projectname.com' },
    update: {},
    create: {
      email: 'vendor@projectname.com',
      name: 'Ravi Kumar',
      phone: '+919876543210',
      passwordHash: demoPassword,
      role: 'VENDOR',
      isActive: true,
      isPhoneVerified: true,
    },
    select: { id: true },
  });

  const vendorSlug = await uniqueSlug('Ravi Store', async (slug) => {
    const row = await prisma.vendorProfile.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(row);
  });

  const vendor = await prisma.vendorProfile.upsert({
    where: { userId: vendorUser.id },
    create: {
      userId: vendorUser.id,
      shopName: 'Ravi Store',
      slug: vendorSlug,
      description: 'Everyday wear and essentials.',
      gstNumber: '27ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      bankHolderName: 'Ravi Kumar',
      bankAccountNo: '000123456789',
      bankIfsc: 'HDFC0000001',
      upiId: 'ravistore@upi',
      commissionRate: 10,
      status: 'APPROVED',
      approvedAt: new Date(),
    },
    update: {},
  });

  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@projectname.com' },
    update: {},
    create: {
      email: 'customer@projectname.com',
      name: 'Amit Sharma',
      phone: '+919812345678',
      passwordHash: demoPassword,
      role: 'CUSTOMER',
      isActive: true,
      isPhoneVerified: true,
    },
    select: { id: true },
  });

  const addressCount = await prisma.address.count({ where: { userId: customerUser.id } });
  if (addressCount === 0) {
    await prisma.address.create({
      data: {
        userId: customerUser.id,
        type: 'HOME',
        fullName: 'Amit Sharma',
        phone: '+919812345678',
        line1: '123 Main Street',
        line2: 'Near Central Park',
        city: 'New Delhi',
        state: 'Delhi',
        stateCode: 'DL',
        country: 'India',
        countryCode: 'IN',
        pincode: '110001',
        isDefault: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'subadmin@projectname.com' },
    update: {},
    create: {
      email: 'subadmin@projectname.com',
      name: 'Sub Admin',
      phone: '',
      passwordHash: demoPassword,
      role: 'SUB_ADMIN',
      isActive: true,
    },
  });

  // ── Demo products ────────────────────────────────────────────────────────
  if (!demoEnabled) return;

  const shirtsId = (await prisma.category.findUnique({ where: { slug: 'shirts' }, select: { id: true } }))!.id;
  const techNovaId = (await prisma.brand.findUnique({ where: { slug: 'technova' }, select: { id: true } }))!.id;

  const productSeeds = [
    {
      name: 'Classic Cotton Shirt',
      slugSeed: 'classic-cotton-shirt',
      description: 'Breathable cotton shirt for everyday wear.',
      sku: 'SHIRT-CLS-001',
      price: 799,
      mrpPrice: 1299,
      stock: 50,
      categoryId: shirtsId,
      brandId: null,
    },
    {
      name: 'Slim Fit Trousers',
      slugSeed: 'slim-fit-trousers',
      description: 'Tailored slim fit trousers.',
      sku: 'TROUSER-SLM-002',
      price: 1199,
      mrpPrice: 1899,
      stock: 35,
      categoryId: shirtsId,
      brandId: null,
    },
    {
      name: 'Wireless Headphones',
      slugSeed: 'wireless-headphones',
      description: 'Over-ear wireless headphones with 30h battery.',
      sku: 'ELEC-WH-100',
      price: 2499,
      mrpPrice: 3999,
      stock: 20,
      categoryId: null,
      brandId: techNovaId,
    },
    {
      name: 'Cotton T-Shirt',
      slugSeed: 'cotton-t-shirt',
      description: 'Soft combed cotton t-shirt.',
      sku: 'TSHIRT-CTN-003',
      price: 499,
      mrpPrice: 899,
      stock: 80,
      categoryId: shirtsId,
      brandId: null,
    },
  ];

  for (const product of productSeeds) {
    const slug = await uniqueSlug(product.slugSeed, async (candidate) => {
      const row = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
      return Boolean(row);
    });

    await prisma.product.upsert({
      where: { slug },
      create: {
        vendorId: vendor.id,
        categoryId: product.categoryId,
        brandId: product.brandId,
        name: product.name,
        slug,
        description: product.description,
        sku: product.sku,
        price: product.price,
        mrpPrice: product.mrpPrice,
        taxPercent: 18,
        stock: product.stock,
        lowStockThreshold: 5,
        status: 'ACTIVE',
        isFeatured: false,
      },
      update: {},
    });
  }

  // ── Coupon / FAQ / Page / Banner / Flash sale ─────────────────────────────
  await prisma.coupon.upsert({
    where: { code: 'WELCOME100' },
    create: {
      code: 'WELCOME100',
      title: 'Welcome offer',
      description: 'Flat 100 off on your first order',
      type: 'FLAT',
      value: 100,
      minOrderAmount: 500,
      maxUsage: 1000,
      maxUsagePerUser: 1,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 86400000),
      isActive: true,
      status: 'ACTIVE',
    },
    update: {},
  });

  await prisma.coupon.upsert({
    where: { code: 'SAVE10' },
    create: {
      code: 'SAVE10',
      title: '10% off',
      description: '10% off up to 300',
      type: 'PERCENT',
      value: 10,
      maxDiscount: 300,
      minOrderAmount: 300,
      maxUsage: 5000,
      maxUsagePerUser: 3,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      isActive: true,
      status: 'ACTIVE',
    },
    update: {},
  });

  for (const faq of [
    { question: 'How long does delivery take?', answer: 'Standard delivery takes 3-6 business days. Express delivery takes 1-3 days.' },
    { question: 'Can I return a product?', answer: 'Yes. Returns are accepted within the return window shown on the product page.' },
    { question: 'What payment methods are accepted?', answer: 'Cash on delivery, UPI, bank transfer, card and net banking.' },
    { question: 'How do I track my order?', answer: 'Open Orders in the app to see live tracking for your order.' },
  ]) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question }, select: { id: true } });
    if (!existing) await prisma.faq.create({ data: faq });
  }

  await prisma.page.upsert({
    where: { slug: 'about-us' },
    create: {
      title: 'About Us',
      slug: 'about-us',
      content: 'ProjectName is a multi-vendor marketplace connecting shoppers with independent sellers.',
      isPublished: true,
    },
    update: {},
  });

  await prisma.page.upsert({
    where: { slug: 'terms-and-conditions' },
    create: {
      title: 'Terms & Conditions',
      slug: 'terms-and-conditions',
      content: 'By using this platform you agree to these terms.',
      isPublished: true,
    },
    update: {},
  });

  await prisma.banner.upsert({
    where: { slug: 'home-hero' },
    create: {
      title: 'Homepage hero',
      slug: 'home-hero',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      type: 'HOME',
      linkUrl: '/products',
      isActive: true,
      sortOrder: 1,
    },
    update: {},
  });

  await prisma.flashSale.upsert({
    where: { slug: 'weekend-flash-sale' },
    create: {
      name: 'Weekend Flash Sale',
      slug: 'weekend-flash-sale',
      startsAt: new Date(Date.now() - 86400000),
      endsAt: new Date(Date.now() + 6 * 86400000),
      discountType: 'PERCENT',
      discountValue: 20,
      isActive: true,
    },
    update: {},
  });

  void superAdminId;
};

const main = async (): Promise<void> => {
  // eslint-disable-next-line no-console
  console.log('[seed] starting...');

  const settings = await seedSettings();
  const permissions = await seedRolePermissions();
  const superAdminId = await seedSuperAdmin();
  await seedDemoData(superAdminId);

  const counts = {
    settings,
    rolePermissions: permissions,
    users: await prisma.user.count(),
    vendors: await prisma.vendorProfile.count(),
    products: await prisma.product.count(),
    categories: await prisma.category.count(),
    coupons: await prisma.coupon.count(),
  };

  // eslint-disable-next-line no-console
  console.log('[seed] complete:', counts);
  // eslint-disable-next-line no-console
  console.log('[seed] demo logins -> superadmin@projectname.com / vendor@projectname.com / customer@projectname.com (password: Demo@12345)');
};

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });