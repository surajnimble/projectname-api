/**
 * Seeds the engagement layer: coupons, flash sales, banners, wallet and loyalty
 * ledgers, referrals, gift cards, notifications, chat, tickets and customer
 * segments.
 *
 * These are the rows the customer app and the support screens read, so every
 * list endpoint has a handful of realistic records instead of an empty state.
 */
import { PrismaClient } from '@prisma/client';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { CatalogContext, CommerceContext, IdentityContext } from './types';

/** Adds the coupons whose usages the order demo records. */
const seedCoupons = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  commerce: CommerceContext,
): Promise<void> => {
  for (const [index, coupon] of [
    {
      code: 'FLAT50',
      title: 'Flat 50 off',
      description: 'Flat 50 off on orders above 299',
      type: 'FLAT',
      value: 50,
      minOrderAmount: 299,
    },
    {
      code: 'FREESHIP',
      title: 'Free shipping',
      description: 'Free standard shipping on any order',
      type: 'FREE_SHIPPING',
      value: 0,
      minOrderAmount: 0,
    },
  ].entries()) {
    await seedRowBy(prisma, 'coupon', { code: coupon.code }, demoId('coupon', coupon.code), {
      ...coupon,
      maxUsage: 500,
      maxUsagePerUser: 2,
      startsAt: daysFromNow(-10 - index),
      expiresAt: daysFromNow(60),
      isActive: true,
      status: 'ACTIVE',
    });
  }

  const coupons = await prisma.coupon.findMany({ select: { id: true }, take: 3 });
  for (const [index, coupon] of coupons.entries()) {
    const orderId = commerce.orderIds[index % commerce.orderIds.length];
    if (!orderId) continue;
    await seedRow(prisma, 'couponUsage', demoId('coupon-usage', index + 1), {
      couponId: coupon.id,
      userId: identity.customerIds[index % identity.customerIds.length],
      orderId,
      amount: 50 + index * 25,
    });
  }
};

/** Adds flash sales, the products in them, and storefront banners. */
const seedPromotions = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
): Promise<void> => {
  const sales = [
    {
      name: 'Mega Electronics Sale',
      slug: 'demo-mega-sale',
      discountType: 'PERCENT',
      discountValue: 25,
      daysFrom: -2,
      daysTo: 5,
    },
    {
      name: 'Clearance Week',
      slug: 'demo-clearance-week',
      discountType: 'FLAT',
      discountValue: 300,
      daysFrom: 1,
      daysTo: 10,
    },
  ];

  for (const sale of sales) {
    await seedRowBy(prisma, 'flashSale', { slug: sale.slug }, demoId('flash-sale', sale.slug), {
      name: sale.name,
      slug: sale.slug,
      banner: `https://picsum.photos/seed/${sale.slug}/1200/400`,
      startsAt: daysFromNow(sale.daysFrom),
      endsAt: daysFromNow(sale.daysTo),
      discountType: sale.discountType,
      discountValue: sale.discountValue,
      isActive: true,
    });
  }

  const flashSales = await prisma.flashSale.findMany({ select: { id: true }, take: 3 });
  for (const [index, slug] of Object.keys(catalog.productIdBySlug).slice(0, 4).entries()) {
    const flashSaleId = flashSales[index % flashSales.length]?.id;
    const productId = catalog.productIdBySlug[slug];
    if (!flashSaleId || !productId) continue;
    await prisma.flashSaleItem.upsert({
      where: { flashSaleId_productId: { flashSaleId, productId } },
      create: {
        flashSaleId,
        productId,
        salePrice: 399 + index * 200,
        saleStock: 20,
        soldCount: index,
        createdById: identity.superAdminId,
      },
      update: {},
    });
  }

  for (const [index, banner] of [
    {
      title: 'Electronics Fest',
      slug: 'demo-electronics-fest',
      image: 'https://picsum.photos/seed/banner-electronics/1600/500',
      linkUrl: '/collections/electronics',
      type: 'HOME',
    },
    {
      title: 'Fashion Week',
      slug: 'demo-fashion-week',
      image: 'https://picsum.photos/seed/banner-fashion/1600/500',
      linkUrl: '/collections/men',
      type: 'CATEGORY',
    },
  ].entries()) {
    await seedRowBy(prisma, 'banner', { slug: banner.slug }, demoId('banner', banner.slug), {
      ...banner,
      isActive: true,
      sortOrder: index + 1,
      startsAt: daysFromNow(-5),
      endsAt: daysFromNow(20),
    });
  }
};

/** Adds wallet, loyalty, referral and gift-card ledgers for the customers. */
const seedRewards = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  commerce: CommerceContext,
): Promise<void> => {
  const walletRows = [
    { type: 'CREDIT', amount: 500, balanceAfter: 500, description: 'Welcome bonus' },
    { type: 'DEBIT', amount: 150, balanceAfter: 350, description: 'Order payment' },
    { type: 'REFUND', amount: 799, balanceAfter: 1149, description: 'Return refund' },
    { type: 'REWARD', amount: 100, balanceAfter: 1249, description: 'Referral reward' },
  ];

  for (const [index, row] of walletRows.entries()) {
    await seedRow(prisma, 'walletTransaction', demoId('wallet-txn', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      type: row.type as any,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      orderId: commerce.orderIds[index % commerce.orderIds.length] ?? '',
      description: row.description,
      status: 'SUCCESS',
      reference: `WALLET-DEMO-${index + 1}`,
    });
  }

  const loyaltyRows = [
    { type: 'EARN', points: 100, balanceAfter: 100, description: 'Order delivered' },
    { type: 'REDEEM', points: -50, balanceAfter: 50, description: 'Redeemed at checkout' },
    { type: 'EARN', points: 200, balanceAfter: 250, description: 'Festival bonus' },
    { type: 'EXPIRE', points: -25, balanceAfter: 225, description: 'Points expired' },
  ];

  for (const [index, row] of loyaltyRows.entries()) {
    await seedRow(prisma, 'loyaltyTransaction', demoId('loyalty-txn', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      type: row.type as any,
      points: row.points,
      balanceAfter: row.balanceAfter,
      orderId: commerce.orderIds[index % commerce.orderIds.length] ?? '',
      description: row.description,
    });
  }

  for (const [index, referral] of [
    { referrerIndex: 0, refereeIndex: 1, status: 'COMPLETED' },
    { referrerIndex: 0, refereeIndex: 2, status: 'PENDING' },
    { referrerIndex: 1, refereeIndex: null, status: 'PENDING' },
  ].entries()) {
    await seedRow(prisma, 'referral', demoId('referral', index + 1), {
      referrerId: identity.customerIds[referral.referrerIndex],
      refereeId:
        referral.refereeIndex === null ? null : identity.customerIds[referral.refereeIndex],
      referralCode: `REF-DEMO-${index + 1}`,
      status: referral.status as any,
      referrerReward: 100,
      refereeReward: 50,
      completedAt: referral.status === 'COMPLETED' ? daysFromNow(-3) : null,
      expiresAt: daysFromNow(90),
    });
  }

  for (const [index, giftCard] of [
    { code: 'GIFT-DEMO-1001', value: 1000, status: 'ACTIVE' },
    { code: 'GIFT-DEMO-1002', value: 500, status: 'ACTIVE' },
    { code: 'GIFT-DEMO-1003', value: 250, status: 'REDEEMED' },
    { code: 'GIFT-DEMO-1004', value: 2000, status: 'EXPIRED' },
  ].entries()) {
    await seedRowBy(prisma, 'giftCard', { code: giftCard.code }, demoId('gift-card', index + 1), {
      code: giftCard.code,
      title: `Gift card ${index + 1}`,
      description: 'Demo gift card',
      value: giftCard.status === 'REDEEMED' ? 0 : giftCard.value,
      initialValue: giftCard.value,
      status: giftCard.status as any,
      userId: identity.customerIds[index % identity.customerIds.length],
      usedOrderId: giftCard.status === 'REDEEMED' ? (commerce.orderIds[0] ?? '') : '',
      expiresAt: daysFromNow(giftCard.status === 'EXPIRED' ? -5 : 120),
      redeemedAt: giftCard.status === 'REDEEMED' ? daysFromNow(-4) : null,
    });
  }
};

/** Adds notifications, their channel preferences and the outbound templates. */
const seedNotifications = async (
  prisma: PrismaClient,
  identity: IdentityContext,
): Promise<void> => {
  const notifications = [
    { type: 'ORDER', channel: 'IN_APP', title: 'Order shipped', body: 'Your order is on the way.' },
    {
      type: 'PAYMENT',
      channel: 'EMAIL',
      title: 'Payment received',
      body: 'We received your payment.',
    },
    { type: 'PROMO', channel: 'PUSH', title: 'Flash sale live', body: 'Up to 40% off today.' },
    {
      type: 'SYSTEM',
      channel: 'IN_APP',
      title: 'Profile updated',
      body: 'Your profile was updated.',
    },
  ];

  for (const [index, row] of notifications.entries()) {
    await seedRow(prisma, 'notification', demoId('notification', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      type: row.type as any,
      channel: row.channel as any,
      title: row.title,
      body: row.body,
      image: `https://picsum.photos/seed/notification-${index + 1}/300/200`,
      data: { deepLink: '/orders' },
      isRead: index === 0,
      readAt: index === 0 ? daysFromNow(-1) : null,
    });
  }

  for (const [index, preference] of [
    { channel: 'EMAIL', eventType: 'ORDER' },
    { channel: 'SMS', eventType: 'PAYMENT' },
    { channel: 'PUSH', eventType: 'PROMO' },
    { channel: 'IN_APP', eventType: 'SYSTEM' },
  ].entries()) {
    await seedRow(prisma, 'notificationPreference', demoId('notification-pref', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      channel: preference.channel as any,
      eventType: preference.eventType,
      isEnabled: index !== 2,
    });
  }

  for (const [index, template] of [
    {
      key: 'demo-order-confirmed',
      name: 'Order confirmed',
      subject: 'Your order {{orderNumber}} is confirmed',
      htmlBody: '<p>Hi {{name}}, your order {{orderNumber}} is confirmed.</p>',
    },
    {
      key: 'demo-password-reset',
      name: 'Password reset',
      subject: 'Reset your password',
      htmlBody: '<p>Use {{code}} to reset your password.</p>',
    },
    {
      key: 'demo-vendor-approved',
      name: 'Vendor approved',
      subject: 'Your shop is live',
      htmlBody: '<p>Congratulations {{shopName}}, your shop is approved.</p>',
    },
    {
      key: 'demo-return-approved',
      name: 'Return approved',
      subject: 'Return {{returnNumber}} approved',
      htmlBody: '<p>Your return has been approved.</p>',
    },
  ].entries()) {
    await seedRowBy(
      prisma,
      'emailTemplate',
      { key: template.key },
      demoId('email-template', index + 1),
      {
        ...template,
        textBody: template.subject,
        variables: ['name', 'orderNumber'],
        isActive: true,
      },
    );
  }

  for (const [index, template] of [
    { key: 'demo-sms-otp', name: 'OTP', body: 'Your OTP is {{code}}. Valid for 10 minutes.' },
    { key: 'demo-sms-order', name: 'Order update', body: 'Order {{orderNumber}} is {{status}}.' },
    { key: 'demo-sms-payment', name: 'Payment', body: 'Payment of {{amount}} received.' },
    { key: 'demo-sms-delivery', name: 'Delivery', body: 'Out for delivery. OTP {{otp}}.' },
  ].entries()) {
    await seedRowBy(
      prisma,
      'smsTemplate',
      { key: template.key },
      demoId('sms-template', index + 1),
      { ...template, variables: ['code'], isActive: true },
    );
  }

  for (const [index, template] of [
    {
      key: 'demo-push-order',
      name: 'Order status',
      channel: 'PUSH',
      title: 'Order update',
      body: 'Your order {{orderNumber}} is {{status}}.',
    },
    {
      key: 'demo-push-promo',
      name: 'Promo',
      channel: 'PUSH',
      title: 'Sale is live',
      body: 'Shop now and save up to 40%.',
    },
    {
      key: 'demo-inapp-welcome',
      name: 'Welcome',
      channel: 'IN_APP',
      title: 'Welcome aboard',
      body: 'Thanks for joining {{siteName}}.',
    },
    {
      key: 'demo-whatsapp-order',
      name: 'WhatsApp order',
      channel: 'WHATSAPP',
      title: 'Order update',
      body: 'Order {{orderNumber}} is confirmed.',
    },
  ].entries()) {
    await seedRowBy(
      prisma,
      'notificationTemplate',
      { key: template.key },
      demoId('notification-template', index + 1),
      { ...template, variables: ['orderNumber', 'status'], isActive: true },
    );
  }
};

/** Adds vendor chat threads, canned replies and user blocks. */
const seedChat = async (prisma: PrismaClient, identity: IdentityContext): Promise<void> => {
  for (const [index, customerId] of identity.customerIds.slice(0, 3).entries()) {
    const conversation = await seedRow(prisma, 'conversation', demoId('conversation', index + 1), {
      lastMessageAt: daysFromNow(-index),
      isActive: true,
      createdAt: daysFromNow(-3 - index),
    });

    await seedRow(
      prisma,
      'conversationParticipant',
      demoId(`participant-${index + 1}`, 'customer'),
      {
        conversationId: conversation.id,
        userId: customerId,
        lastReadAt: daysFromNow(-1),
        isArchived: false,
      },
    );

    await seedRow(prisma, 'conversationParticipant', demoId(`participant-${index + 1}`, 'vendor'), {
      conversationId: conversation.id,
      userId: identity.vendorUserIds[index % identity.vendorUserIds.length],
      vendorId: identity.vendorIds[index % 2 === 0 ? 'main' : 'second'],
      lastReadAt: daysFromNow(-1),
      isArchived: false,
    });

    await seedRow(prisma, 'message', demoId('message', index + 1), {
      conversationId: conversation.id,
      senderId: identity.vendorUserIds[index % identity.vendorUserIds.length],
      body: `Thanks for reaching out about order ${index + 1}. How can we help?`,
      attachments: [],
      isRead: index === 0,
      readAt: index === 0 ? daysFromNow(-1) : null,
      createdAt: daysFromNow(-index),
    });

    await seedRow(prisma, 'message', demoId(`message-${index + 1}-reply`, 1), {
      conversationId: conversation.id,
      senderId: customerId,
      body: 'I have a question about the delivery date.',
      attachments: [],
      isRead: false,
      createdAt: daysFromNow(-index),
    });
  }

  for (const [index, canned] of [
    { title: 'Order delay', body: 'We are sorry for the delay. Your order ships tomorrow.' },
    { title: 'Refund timeline', body: 'Refunds reach your account in 5-7 business days.' },
    { title: 'Return policy', body: 'Returns are accepted within 7 days of delivery.' },
    { title: 'Thank you', body: 'Thanks for shopping with us!' },
  ].entries()) {
    await seedRow(prisma, 'cannedResponse', demoId('canned-response', index + 1), {
      title: canned.title,
      body: canned.body,
      isActive: true,
      createdBy: identity.superAdminId,
    });
  }

  for (const [index, block] of [
    { blockerIndex: 0, blockedIndex: 1, reason: 'Abusive language' },
    { blockerIndex: 1, blockedIndex: 2, reason: 'Spam' },
    { blockerIndex: 2, blockedIndex: 0, reason: 'Unwanted contact' },
  ].entries()) {
    await seedRow(prisma, 'userBlock', demoId('user-block', index + 1), {
      blockerId: identity.customerIds[block.blockerIndex],
      blockedId: identity.customerIds[block.blockedIndex],
      reason: block.reason,
    });
  }
};

/** Adds support tickets, their replies, notes and the customer records. */
const seedSupport = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  commerce: CommerceContext,
): Promise<void> => {
  const categories = await prisma.ticketCategory.findMany({ select: { id: true }, take: 3 });

  for (const [index, ticket] of [
    { subject: 'Refund not received', status: 'OPEN', priority: 'HIGH' },
    { subject: 'Wrong item delivered', status: 'IN_PROGRESS', priority: 'URGENT' },
    { subject: 'Cannot log in', status: 'RESOLVED', priority: 'MEDIUM' },
    { subject: 'Delivery address change', status: 'CLOSED', priority: 'LOW' },
  ].entries()) {
    const row = await seedRowBy(
      prisma,
      'ticket',
      { ticketNumber: `TKT-DEMO-${3001 + index}` },
      demoId('ticket', index + 1),
      {
        ticketNumber: `TKT-DEMO-${3001 + index}`,
        userId: identity.customerIds[index % identity.customerIds.length],
        categoryId: categories[index % categories.length]?.id ?? null,
        subject: ticket.subject,
        description: 'Demo ticket created by the local seed.',
        priority: ticket.priority as any,
        status: ticket.status as any,
        assignedToId: index % 2 === 0 ? identity.subAdminId : null,
        resolvedAt: ['RESOLVED', 'CLOSED'].includes(ticket.status) ? daysFromNow(-2) : null,
        closedAt: ticket.status === 'CLOSED' ? daysFromNow(-1) : null,
        createdAt: daysFromNow(-8 + index),
      },
    );

    await seedRow(prisma, 'ticketMessage', demoId('ticket-message', index + 1), {
      ticketId: row.id,
      userId: identity.customerIds[index % identity.customerIds.length],
      message: 'This is a follow-up message from the customer.',
      isInternal: false,
    });

    if (index < 3) {
      await seedRow(prisma, 'ticketNote', demoId('ticket-note', index + 1), {
        ticketId: row.id,
        userId: identity.subAdminId || identity.superAdminId,
        note: 'Internal note: escalated to the operations team.',
      });
    }
  }

  for (const [index, note] of [
    'Prefers email over phone calls.',
    'Repeated buyer, offer loyalty discount.',
    'Has an open return request.',
    'Flagged for a payment review once.',
  ].entries()) {
    await seedRow(prisma, 'customerNote', demoId('customer-note', index + 1), {
      userId: identity.customerIds[index % identity.customerIds.length],
      createdById: identity.subAdminId || identity.superAdminId,
      note,
      createdAt: daysFromNow(-6 + index),
    });
  }

  await seedRowBy(
    prisma,
    'customerBan',
    { userId: identity.customerIds[3] },
    demoId('customer-ban', 1),
    {
      userId: identity.customerIds[3],
      reason: 'Chargeback abuse',
      expiresAt: daysFromNow(30),
      createdById: identity.superAdminId,
    },
  );

  await seedRowBy(
    prisma,
    'customerBan',
    { userId: identity.customerIds[2] },
    demoId('customer-ban', 2),
    {
      userId: identity.customerIds[2],
      reason: 'Duplicate accounts',
      revokedAt: daysFromNow(-5),
      revokeReason: 'Appeal accepted',
      createdById: identity.superAdminId,
    },
  );

  await seedRowBy(
    prisma,
    'customerBan',
    { userId: identity.customerIds[1] },
    demoId('customer-ban', 3),
    {
      userId: identity.customerIds[1],
      reason: 'Repeated failed payments',
      revokedAt: daysFromNow(-15),
      revokeReason: 'Payment method verified',
      createdById: identity.superAdminId,
    },
  );

  for (const [index, segment] of [
    { name: 'New Customers', slug: 'new-customers', kind: 'NEW' },
    { name: 'Repeat Buyers', slug: 'repeat-buyers', kind: 'REPEAT' },
    { name: 'VIP Shoppers', slug: 'vip-shoppers', kind: 'VIP' },
    { name: 'Blocked Users', slug: 'blocked-users', kind: 'BLOCKED' },
  ].entries()) {
    const row = await seedRowBy(
      prisma,
      'customerSegment',
      { slug: segment.slug },
      demoId('customer-segment', index + 1),
      {
        name: segment.name,
        slug: segment.slug,
        description: `${segment.name} demo segment`,
        color: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'][index],
        kind: segment.kind as any,
        isActive: true,
      },
    );

    await seedRow(prisma, 'customerSegmentMember', demoId('segment-member', index + 1), {
      segmentId: row.id,
      userId: identity.customerIds[index % identity.customerIds.length],
      source: 'MANUAL',
      assignedById: identity.superAdminId,
    });
  }

  void commerce;
};

/** Seeds every engagement row the customer and support screens read. */
export const seedEngagementModule = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
  commerce: CommerceContext,
): Promise<void> => {
  await seedCoupons(prisma, identity, commerce);
  await seedPromotions(prisma, identity, catalog);
  await seedRewards(prisma, identity, commerce);
  await seedNotifications(prisma, identity);
  await seedChat(prisma, identity);
  await seedSupport(prisma, identity, commerce);

  // eslint-disable-next-line no-console
  console.log(
    '[seed]   engagement (coupons, flash sales, banners, wallet, loyalty, notifications, chat, tickets) — done',
  );
};
