import { PGlite } from '@electric-sql/pglite';

const DATA_DIR = process.env.PGLITE_DATA_DIR ?? 'pglite-data';

interface Count {
  label: string;
  sql: string;
}

const CHECKS: Count[] = [
  { label: 'settings', sql: 'SELECT count(*)::int AS c FROM "SystemSetting"' },
  { label: 'rolePermissions', sql: 'SELECT count(*)::int AS c FROM "RolePermission"' },
  { label: 'users', sql: 'SELECT count(*)::int AS c FROM "User"' },
  { label: 'superAdmins', sql: `SELECT count(*)::int AS c FROM "User" WHERE role = 'SUPER_ADMIN'` },
  { label: 'vendors', sql: 'SELECT count(*)::int AS c FROM "VendorProfile"' },
  { label: 'kycDocuments', sql: 'SELECT count(*)::int AS c FROM "KycDocument"' },
  { label: 'vendorAnnouncements', sql: 'SELECT count(*)::int AS c FROM "VendorAnnouncement"' },
  { label: 'devices', sql: 'SELECT count(*)::int AS c FROM "Device"' },
  { label: 'sessions', sql: 'SELECT count(*)::int AS c FROM "Session"' },
  { label: 'refreshTokens', sql: 'SELECT count(*)::int AS c FROM "RefreshToken"' },
  { label: 'passwordHistory', sql: 'SELECT count(*)::int AS c FROM "PasswordHistory"' },
  { label: 'userConsents', sql: 'SELECT count(*)::int AS c FROM "UserConsent"' },
  { label: 'otps', sql: 'SELECT count(*)::int AS c FROM "Otp"' },
  { label: 'authVerifications', sql: 'SELECT count(*)::int AS c FROM "AuthVerification"' },
  { label: 'socialAccounts', sql: 'SELECT count(*)::int AS c FROM "SocialAccount"' },
  { label: 'addresses', sql: 'SELECT count(*)::int AS c FROM "Address"' },
  { label: 'categories', sql: 'SELECT count(*)::int AS c FROM "Category"' },
  { label: 'brands', sql: 'SELECT count(*)::int AS c FROM "Brand"' },
  { label: 'tags', sql: 'SELECT count(*)::int AS c FROM "Tag"' },
  { label: 'attributes', sql: 'SELECT count(*)::int AS c FROM "Attribute"' },
  { label: 'attributeValues', sql: 'SELECT count(*)::int AS c FROM "ProductAttributeValue"' },
  { label: 'products', sql: 'SELECT count(*)::int AS c FROM "Product"' },
  { label: 'productImages', sql: 'SELECT count(*)::int AS c FROM "ProductImage"' },
  { label: 'productVariants', sql: 'SELECT count(*)::int AS c FROM "ProductVariant"' },
  { label: 'productTags', sql: 'SELECT count(*)::int AS c FROM "ProductTag"' },
  { label: 'collections', sql: 'SELECT count(*)::int AS c FROM "Collection"' },
  { label: 'collectionProducts', sql: 'SELECT count(*)::int AS c FROM "CollectionProduct"' },
  { label: 'recentlyViewed', sql: 'SELECT count(*)::int AS c FROM "RecentlyViewed"' },
  { label: 'carts', sql: 'SELECT count(*)::int AS c FROM "Cart"' },
  { label: 'cartItems', sql: 'SELECT count(*)::int AS c FROM "CartItem"' },
  { label: 'savedCartItems', sql: 'SELECT count(*)::int AS c FROM "SavedCartItem"' },
  { label: 'priceWatches', sql: 'SELECT count(*)::int AS c FROM "PriceWatch"' },
  { label: 'wishlists', sql: 'SELECT count(*)::int AS c FROM "Wishlist"' },
  { label: 'wishlistItems', sql: 'SELECT count(*)::int AS c FROM "WishlistItem"' },
  { label: 'orders', sql: 'SELECT count(*)::int AS c FROM "Order"' },
  { label: 'orderItems', sql: 'SELECT count(*)::int AS c FROM "OrderItem"' },
  { label: 'subOrders', sql: 'SELECT count(*)::int AS c FROM "SubOrder"' },
  { label: 'orderTimelines', sql: 'SELECT count(*)::int AS c FROM "OrderTimeline"' },
  { label: 'orderTags', sql: 'SELECT count(*)::int AS c FROM "OrderTag"' },
  { label: 'orderNotes', sql: 'SELECT count(*)::int AS c FROM "OrderNote"' },
  { label: 'payments', sql: 'SELECT count(*)::int AS c FROM "Payment"' },
  { label: 'idempotencyKeys', sql: 'SELECT count(*)::int AS c FROM "IdempotencyKey"' },
  { label: 'refunds', sql: 'SELECT count(*)::int AS c FROM "Refund"' },
  { label: 'vendorEarnings', sql: 'SELECT count(*)::int AS c FROM "VendorEarning"' },
  { label: 'payouts', sql: 'SELECT count(*)::int AS c FROM "Payout"' },
  { label: 'returnReasons', sql: 'SELECT count(*)::int AS c FROM "ReturnReason"' },
  { label: 'returnRequests', sql: 'SELECT count(*)::int AS c FROM "ReturnRequest"' },
  { label: 'returnItems', sql: 'SELECT count(*)::int AS c FROM "ReturnItem"' },
  { label: 'exchangeItems', sql: 'SELECT count(*)::int AS c FROM "ExchangeItem"' },
  { label: 'reviews', sql: 'SELECT count(*)::int AS c FROM "Review"' },
  { label: 'questions', sql: 'SELECT count(*)::int AS c FROM "Question"' },
  { label: 'answers', sql: 'SELECT count(*)::int AS c FROM "Answer"' },
  { label: 'coupons', sql: 'SELECT count(*)::int AS c FROM "Coupon"' },
  { label: 'couponUsages', sql: 'SELECT count(*)::int AS c FROM "CouponUsage"' },
  { label: 'flashSales', sql: 'SELECT count(*)::int AS c FROM "FlashSale"' },
  { label: 'flashSaleItems', sql: 'SELECT count(*)::int AS c FROM "FlashSaleItem"' },
  { label: 'banners', sql: 'SELECT count(*)::int AS c FROM "Banner"' },
  { label: 'walletTransactions', sql: 'SELECT count(*)::int AS c FROM "WalletTransaction"' },
  { label: 'loyaltyTransactions', sql: 'SELECT count(*)::int AS c FROM "LoyaltyTransaction"' },
  { label: 'referrals', sql: 'SELECT count(*)::int AS c FROM "Referral"' },
  { label: 'giftCards', sql: 'SELECT count(*)::int AS c FROM "GiftCard"' },
  { label: 'notifications', sql: 'SELECT count(*)::int AS c FROM "Notification"' },
  { label: 'notificationPrefs', sql: 'SELECT count(*)::int AS c FROM "NotificationPreference"' },
  { label: 'emailTemplates', sql: 'SELECT count(*)::int AS c FROM "EmailTemplate"' },
  { label: 'smsTemplates', sql: 'SELECT count(*)::int AS c FROM "SmsTemplate"' },
  { label: 'notificationTemplates', sql: 'SELECT count(*)::int AS c FROM "NotificationTemplate"' },
  { label: 'conversations', sql: 'SELECT count(*)::int AS c FROM "Conversation"' },
  { label: 'conversationParts', sql: 'SELECT count(*)::int AS c FROM "ConversationParticipant"' },
  { label: 'messages', sql: 'SELECT count(*)::int AS c FROM "Message"' },
  { label: 'cannedResponses', sql: 'SELECT count(*)::int AS c FROM "CannedResponse"' },
  { label: 'userBlocks', sql: 'SELECT count(*)::int AS c FROM "UserBlock"' },
  { label: 'ticketCategories', sql: 'SELECT count(*)::int AS c FROM "TicketCategory"' },
  { label: 'tickets', sql: 'SELECT count(*)::int AS c FROM "Ticket"' },
  { label: 'ticketMessages', sql: 'SELECT count(*)::int AS c FROM "TicketMessage"' },
  { label: 'ticketNotes', sql: 'SELECT count(*)::int AS c FROM "TicketNote"' },
  { label: 'customerNotes', sql: 'SELECT count(*)::int AS c FROM "CustomerNote"' },
  { label: 'customerBans', sql: 'SELECT count(*)::int AS c FROM "CustomerBan"' },
  { label: 'customerSegments', sql: 'SELECT count(*)::int AS c FROM "CustomerSegment"' },
  { label: 'segmentMembers', sql: 'SELECT count(*)::int AS c FROM "CustomerSegmentMember"' },
  { label: 'pages', sql: 'SELECT count(*)::int AS c FROM "Page"' },
  { label: 'blogs', sql: 'SELECT count(*)::int AS c FROM "Blog"' },
  { label: 'faqs', sql: 'SELECT count(*)::int AS c FROM "Faq"' },
  { label: 'contactSubmissions', sql: 'SELECT count(*)::int AS c FROM "ContactSubmission"' },
  { label: 'newsletterSubscribers', sql: 'SELECT count(*)::int AS c FROM "NewsletterSubscriber"' },
  { label: 'dropdowns', sql: 'SELECT count(*)::int AS c FROM "Dropdown"' },
  { label: 'translations', sql: 'SELECT count(*)::int AS c FROM "Translation"' },
  { label: 'currencies', sql: 'SELECT count(*)::int AS c FROM "Currency"' },
  { label: 'taxConfigs', sql: 'SELECT count(*)::int AS c FROM "TaxConfig"' },
  { label: 'countries', sql: 'SELECT count(*)::int AS c FROM "Country"' },
  { label: 'states', sql: 'SELECT count(*)::int AS c FROM "State"' },
  { label: 'cities', sql: 'SELECT count(*)::int AS c FROM "City"' },
  { label: 'shippingZones', sql: 'SELECT count(*)::int AS c FROM "ShippingZone"' },
  { label: 'shippingMethods', sql: 'SELECT count(*)::int AS c FROM "ShippingMethod"' },
  { label: 'shippingPartners', sql: 'SELECT count(*)::int AS c FROM "ShippingPartner"' },
  { label: 'shipments', sql: 'SELECT count(*)::int AS c FROM "Shipment"' },
  { label: 'deliveryBoys', sql: 'SELECT count(*)::int AS c FROM "DeliveryBoy"' },
  { label: 'deliveries', sql: 'SELECT count(*)::int AS c FROM "Delivery"' },
  { label: 'auditLogs', sql: 'SELECT count(*)::int AS c FROM "AuditLog"' },
  { label: 'activityLogs', sql: 'SELECT count(*)::int AS c FROM "ActivityLog"' },
  { label: 'apiKeys', sql: 'SELECT count(*)::int AS c FROM "ApiKey"' },
  { label: 'webhookEndpoints', sql: 'SELECT count(*)::int AS c FROM "WebhookEndpoint"' },
  { label: 'webhookLogs', sql: 'SELECT count(*)::int AS c FROM "WebhookLog"' },
  { label: 'bulkJobs', sql: 'SELECT count(*)::int AS c FROM "BulkJob"' },
  { label: 'failedJobs', sql: 'SELECT count(*)::int AS c FROM "FailedJob"' },
  { label: 'reportSchedules', sql: 'SELECT count(*)::int AS c FROM "ReportSchedule"' },
  { label: 'searchLogs', sql: 'SELECT count(*)::int AS c FROM "SearchLog"' },
  { label: 'visitorLogs', sql: 'SELECT count(*)::int AS c FROM "VisitorLog"' },
  { label: 'pageViews', sql: 'SELECT count(*)::int AS c FROM "PageView"' },
  { label: 'events', sql: 'SELECT count(*)::int AS c FROM "Event"' },
  { label: 'crashLogs', sql: 'SELECT count(*)::int AS c FROM "CrashLog"' },
  { label: 'funnels', sql: 'SELECT count(*)::int AS c FROM "Funnel"' },
  { label: 'funnelSteps', sql: 'SELECT count(*)::int AS c FROM "FunnelStep"' },
  { label: 'funnelConversions', sql: 'SELECT count(*)::int AS c FROM "FunnelConversion"' },
  { label: 'analyticsDaily', sql: 'SELECT count(*)::int AS c FROM "AnalyticsDaily"' },
  { label: 'geoVisits', sql: 'SELECT count(*)::int AS c FROM "GeoVisit"' },
];

const main = async (): Promise<void> => {
  const db = await PGlite.create({ dataDir: DATA_DIR });

  try {
    /* eslint-disable no-console */
    console.log('entity                count');
    console.log('---------------------------------');
    for (const check of CHECKS) {
      const result = await db.query<{ c: number }>(check.sql);
      console.log(`${check.label.padEnd(22)} ${result.rows[0].c}`);
    }

    const settings = await db.query<{ category: string; c: number }>(
      'SELECT category, count(*)::int AS c FROM "SystemSetting" GROUP BY category ORDER BY category',
    );
    console.log('\nsettings by category:');
    for (const row of settings.rows) {
      console.log(`  ${row.category.padEnd(14)} ${row.c}`);
    }

    const pub = await db.query<{ c: number }>(
      'SELECT count(*)::int AS c FROM "SystemSetting" WHERE "isPublic" = true',
    );
    console.log(`\npublic settings      ${pub.rows[0].c}`);

    const superAdmins = await db.query<{ email: string; name: string }>(
      `SELECT email, name FROM "User" WHERE role = 'SUPER_ADMIN'`,
    );
    console.log('\nsuper admin:');
    for (const row of superAdmins.rows) {
      console.log(`  ${row.email} (${row.name})`);
    }
    /* eslint-enable no-console */
  } finally {
    await db.close();
  }
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed-check] failed:', err?.message ?? err);
  process.exit(1);
});
