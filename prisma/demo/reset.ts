/**
 * Clears every business table before the local demo seed runs.
 *
 * Only called from the demo path, which is disabled in production. Settings and
 * role permissions are left in place: they are configuration, not demo rows, and
 * the seed upserts them again anyway. Accounts are preserved as well, so a super
 * admin (or anyone else) who changed their password keeps it across reseeds.
 */
import { PrismaClient } from '@prisma/client';

/**
 * Every table the seed owns, in one TRUNCATE.
 *
 * `CASCADE` follows the foreign keys, so order inside this list does not matter;
 * listing every table explicitly keeps the intent readable.
 */
const DEMO_TABLES = [
  'RefreshToken',
  'PasswordHistory',
  'UserConsent',
  'Otp',
  'AuthVerification',
  'SocialAccount',
  'Session',
  'Device',
  'Address',
  'KycDocument',
  'VendorAnnouncement',
  'VendorProfile',
  'ProductAttributeValue',
  'ProductImage',
  'ProductVariant',
  'ProductTag',
  'CollectionProduct',
  'RecentlyViewed',
  'CartItem',
  'SavedCartItem',
  'PriceWatch',
  'WishlistItem',
  'Cart',
  'Wishlist',
  'Product',
  'Collection',
  'Attribute',
  'Tag',
  'Brand',
  'Category',
  'OrderTag',
  'OrderNote',
  'OrderTimeline',
  'OrderItem',
  'SubOrder',
  'Shipment',
  'Delivery',
  'DeliveryBoy',
  'Refund',
  'VendorEarning',
  'Payout',
  'Payment',
  'IdempotencyKey',
  'ReturnItem',
  'ExchangeItem',
  'ReturnRequest',
  'ReturnReason',
  'Order',
  'Review',
  'Question',
  'Answer',
  'CouponUsage',
  'Coupon',
  'FlashSaleItem',
  'FlashSale',
  'Banner',
  'WalletTransaction',
  'LoyaltyTransaction',
  'Referral',
  'GiftCard',
  'Notification',
  'NotificationPreference',
  'EmailTemplate',
  'SmsTemplate',
  'NotificationTemplate',
  'ConversationParticipant',
  'Message',
  'Conversation',
  'CannedResponse',
  'UserBlock',
  'TicketMessage',
  'TicketNote',
  'Ticket',
  'TicketCategory',
  'CustomerNote',
  'CustomerBan',
  'CustomerSegmentMember',
  'CustomerSegment',
  'Page',
  'Blog',
  'Faq',
  'ContactSubmission',
  'NewsletterSubscriber',
  'Dropdown',
  'Translation',
  'Currency',
  'TaxConfig',
  'City',
  'State',
  'Country',
  'ShippingMethod',
  'ShippingPartner',
  'ShippingZone',
  'AuditLog',
  'ActivityLog',
  'ApiKey',
  'WebhookLog',
  'WebhookEndpoint',
  'BulkJob',
  'FailedJob',
  'ReportSchedule',
  'SearchLog',
  'VisitorLog',
  'PageView',
  'Event',
  'CrashLog',
  'FunnelConversion',
  'FunnelStep',
  'Funnel',
  'AnalyticsDaily',
  'GeoVisit',
];

/** Deletes every demo-owned row so the seed can rebuild a clean dataset. */
export const resetDemoData = async (prisma: PrismaClient): Promise<void> => {
  // PGlite rejects one very long TRUNCATE statement, so the list goes in chunks.
  const chunkSize = 10;
  for (let index = 0; index < DEMO_TABLES.length; index += chunkSize) {
    const tables = DEMO_TABLES.slice(index, index + chunkSize)
      .map((table) => `"${table}"`)
      .join(', ');
    // Each chunk gets a unique comment so Prisma prepares a distinct statement;
    // PGlite rejects re-preparing an existing statement name (e.g. "s0") across calls.
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE -- chunk ${index}`,
    );
  }
};
