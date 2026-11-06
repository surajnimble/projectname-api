/**
 * Seeds the commerce flow: carts, orders, payments, payouts, returns, reviews
 * and Q&A.
 *
 * Orders are spread across statuses and vendors so the customer, vendor and
 * admin order screens each have something to show, and every downstream row
 * (payment, shipment, return, refund) points at a real parent.
 */
import { PrismaClient } from '@prisma/client';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { CatalogContext, CommerceContext, IdentityContext } from './types';

interface DemoOrder {
  key: string;
  orderNumber: string;
  customerIndex: number;
  vendorKey: 'main' | 'second';
  status: 'DELIVERED' | 'SHIPPED' | 'CONFIRMED' | 'PENDING';
  paymentMethod: 'UPI' | 'CARD' | 'COD';
  paymentStatus: 'PAID' | 'COD_PENDING' | 'PENDING';
  productSlug: string;
  qty: number;
  price: number;
  shipping: number;
  placedDaysAgo: number;
}

const ORDERS: DemoOrder[] = [
  {
    key: '1',
    orderNumber: 'ORD-DEMO-1001',
    customerIndex: 0,
    vendorKey: 'main',
    status: 'DELIVERED',
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    productSlug: 'classic-cotton-shirt',
    qty: 2,
    price: 799,
    shipping: 0,
    placedDaysAgo: 12,
  },
  {
    key: '2',
    orderNumber: 'ORD-DEMO-1002',
    customerIndex: 1,
    vendorKey: 'second',
    status: 'SHIPPED',
    paymentMethod: 'CARD',
    paymentStatus: 'PAID',
    productSlug: 'smart-watch-pro',
    qty: 1,
    price: 3499,
    shipping: 49,
    placedDaysAgo: 4,
  },
  {
    key: '3',
    orderNumber: 'ORD-DEMO-1003',
    customerIndex: 2,
    vendorKey: 'main',
    status: 'CONFIRMED',
    paymentMethod: 'COD',
    paymentStatus: 'COD_PENDING',
    productSlug: 'slim-fit-trousers',
    qty: 1,
    price: 1199,
    shipping: 49,
    placedDaysAgo: 2,
  },
  {
    key: '4',
    orderNumber: 'ORD-DEMO-1004',
    customerIndex: 0,
    vendorKey: 'second',
    status: 'PENDING',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    productSlug: 'bluetooth-speaker-mini',
    qty: 1,
    price: 1499,
    shipping: 49,
    placedDaysAgo: 1,
  },
  {
    key: '5', orderNumber: 'ORD-DEMO-1005', customerIndex: 4, vendorKey: 'main', status: 'CONFIRMED',
    paymentMethod: 'UPI', paymentStatus: 'PAID', productSlug: 'fitness-band-lite', qty: 1,
    price: 1999, shipping: 0, placedDaysAgo: 3,
  },
  {
    key: '6', orderNumber: 'ORD-DEMO-1006', customerIndex: 5, vendorKey: 'second', status: 'DELIVERED',
    paymentMethod: 'CARD', paymentStatus: 'PAID', productSlug: 'wireless-headphones', qty: 1,
    price: 2499, shipping: 49, placedDaysAgo: 16,
  },
  {
    key: '7', orderNumber: 'ORD-DEMO-1007', customerIndex: 6, vendorKey: 'main', status: 'PENDING',
    paymentMethod: 'COD', paymentStatus: 'PENDING', productSlug: 'cotton-t-shirt', qty: 2,
    price: 499, shipping: 49, placedDaysAgo: 0,
  },
];

/** Creates the orders, their vendor split, line items and timeline. */
const seedOrders = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
): Promise<Pick<CommerceContext, 'orderIds' | 'orderItemIds' | 'subOrderIds'>> => {
  const orderIds: string[] = [];
  const orderItemIds: string[] = [];
  const subOrderIds: string[] = [];

  for (const order of ORDERS) {
    const customerId = identity.customerIds[order.customerIndex];
    const addressId = identity.addressIds[order.customerIndex] ?? identity.addressIds[0];
    const vendorId = identity.vendorIds[order.vendorKey];
    const productId = catalog.productIdBySlug[order.productSlug];
    const subtotal = order.price * order.qty;
    const taxAmount = Number((subtotal * 0.18).toFixed(2));
    const total = Number((subtotal + taxAmount + order.shipping).toFixed(2));
    const placedAt = daysFromNow(-order.placedDaysAgo);
    const delivered = order.status === 'DELIVERED';

    const orderRow = await seedRowBy(
      prisma,
      'order',
      { orderNumber: order.orderNumber },
      demoId('order', order.key),
      {
        orderNumber: order.orderNumber,
        userId: customerId,
        addressId,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        currency: 'INR',
        subtotal,
        discount: 0,
        couponDiscount: 0,
        taxAmount,
        shippingAmount: order.shipping,
        giftWrapAmount: 0,
        walletAmount: 0,
        total,
        notes: 'Demo order created by the local seed.',
        deliveredAt: delivered ? daysFromNow(-order.placedDaysAgo + 4) : null,
        createdAt: placedAt,
      },
    );
    orderIds.push(orderRow.id);

    const subOrderRow = await seedRow(prisma, 'subOrder', demoId('sub-order', order.key), {
      orderId: orderRow.id,
      vendorId,
      status: order.status,
      subtotal,
      taxAmount,
      shippingAmount: order.shipping,
      total,
      commissionRate: 10,
      commission: Number((subtotal * 0.1).toFixed(2)),
      platformFee: 10,
      vendorEarning: Number((subtotal - subtotal * 0.1 - 10).toFixed(2)),
      deliveryBoyId: order.status === 'SHIPPED' ? identity.deliveryBoyIds[0] : null,
      trackingNumber: `AWB-DEMO-${order.key}0001`,
      createdAt: placedAt,
    });
    subOrderIds.push(subOrderRow.id);

    const itemRow = await seedRow(prisma, 'orderItem', demoId('order-item', order.key), {
      orderId: orderRow.id,
      subOrderId: subOrderRow.id,
      productId,
      name: order.productSlug.replace(/-/g, ' '),
      sku: `SKU-${order.key}`,
      image: `https://picsum.photos/seed/${order.productSlug}/200/200`,
      attributes: {},
      price: order.price,
      qty: order.qty,
      taxPercent: 18,
      taxAmount,
      total,
      vendorEarning: Number((subtotal - subtotal * 0.1).toFixed(2)),
      commission: Number((subtotal * 0.1).toFixed(2)),
    });
    orderItemIds.push(itemRow.id);

    const timeline = [
      {
        status: order.status,
        fromStatus: '',
        remark: 'Order placed',
        daysAgo: order.placedDaysAgo,
      },
      {
        status: order.status,
        fromStatus: 'PENDING',
        remark: `Marked ${order.status.toLowerCase()}`,
        daysAgo: Math.max(0, order.placedDaysAgo - 1),
      },
    ];

    for (const [index, step] of timeline.entries()) {
      await seedRow(prisma, 'orderTimeline', demoId(`order-timeline-${order.key}`, index + 1), {
        orderId: orderRow.id,
        subOrderId: subOrderRow.id,
        status: step.status as any,
        fromStatus: step.fromStatus,
        remark: step.remark,
        location: 'New Delhi',
        createdById: identity.superAdminId,
        createdAt: daysFromNow(-step.daysAgo),
      });
    }
  }

  return { orderIds, orderItemIds, subOrderIds };
};

/** Adds tags and internal notes to the demo orders. */
const seedOrderExtras = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  orderIds: string[],
): Promise<void> => {
  for (const [index, label] of ['priority', 'gift', 'repeat-customer', 'fragile', 'express', 'wholesale', 'follow-up'].entries()) {
    await seedRow(prisma, 'orderTag', demoId('order-tag', index + 1), {
      orderId: orderIds[index % orderIds.length],
      label,
      color: index === 0 ? 'red' : index === 1 ? 'green' : 'blue',
      createdBy: identity.superAdminId,
    });
  }

  for (const [index, note] of [
    'Customer asked for delivery after 6 pm.',
    'Packed with extra bubble wrap.',
    'Follow up if the shipment is delayed.',
    'Customer requested a gift receipt.',
    'Confirm address before dispatch.',
    'Seller packed the order separately.',
    'Escalate if dispatch is delayed.',
  ].entries()) {
    await seedRow(prisma, 'orderNote', demoId('order-note', index + 1), {
      orderId: orderIds[index % orderIds.length],
      userId: identity.subAdminId || identity.superAdminId,
      note,
    });
  }
};

/** Creates the payments, refunds, earnings and payouts behind the orders. */
const seedMoney = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  orderIds: string[],
  subOrderIds: string[],
): Promise<string[]> => {
  const paymentIds: string[] = [];

  for (const [index, order] of ORDERS.entries()) {
    const orderRow = await prisma.order.findUnique({
      where: { orderNumber: order.orderNumber },
      select: { id: true, userId: true, total: true },
    });
    if (!orderRow) continue;

    const payment = await seedRow(prisma, 'payment', demoId('payment', order.key), {
      orderId: orderRow.id,
      userId: orderRow.userId,
      amount: orderRow.total,
      paidAmount: order.paymentStatus === 'PAID' ? orderRow.total : 0,
      method: order.paymentMethod as any,
      status: order.paymentStatus as any,
      reference: `PAY-DEMO-${order.key}0001`,
      providerRef: `provider-ref-${order.key}`,
      gatewayData: { demo: true },
      paidAt: order.paymentStatus === 'PAID' ? daysFromNow(-order.placedDaysAgo) : null,
    });
    paymentIds.push(payment.id);

    const vendorKey = order.vendorKey;
    await seedRow(prisma, 'vendorEarning', demoId('vendor-earning', order.key), {
      vendorId: identity.vendorIds[vendorKey],
      subOrderId: subOrderIds[index],
      orderId: orderRow.id,
      amount: orderRow.total,
      commission: Number((orderRow.total * 0.1).toFixed(2)),
      platformFee: 10,
      netAmount: Number((orderRow.total * 0.9 - 10).toFixed(2)),
      status: order.status === 'DELIVERED' ? 'PAID' : 'PENDING',
      period: '2026-10',
      isAvailable: order.status === 'DELIVERED',
      availableAt: order.status === 'DELIVERED' ? daysFromNow(-1) : null,
    });
  }

  for (const [index, refund] of [
    { paymentIndex: 0, amount: 799, reason: 'Item returned', status: 'REFUNDED' },
    { paymentIndex: 1, amount: 500, reason: 'Price difference', status: 'PENDING' },
    { paymentIndex: 2, amount: 250, reason: 'Partial cancellation', status: 'PENDING' },
    { paymentIndex: 3, amount: 149, reason: 'Shipping fee adjustment', status: 'PENDING' },
    { paymentIndex: 4, amount: 199, reason: 'Promotional price adjustment', status: 'PENDING' },
    { paymentIndex: 5, amount: 300, reason: 'Damaged packaging goodwill', status: 'REFUNDED' },
    { paymentIndex: 6, amount: 99, reason: 'Duplicate charge review', status: 'PENDING' },
  ].entries()) {
    const paymentId = paymentIds[refund.paymentIndex];
    if (!paymentId) continue;
    await seedRow(prisma, 'refund', demoId('refund', index + 1), {
      paymentId,
      orderId: orderIds[refund.paymentIndex],
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status as any,
      providerRef: `refund-ref-${index + 1}`,
      isInitiatedBy: identity.superAdminId,
      processedAt: refund.status === 'REFUNDED' ? daysFromNow(-3) : null,
    });
  }

  for (const [index, payout] of [
    { amount: 12500, status: 'PAID', method: 'BANK' },
    { amount: 3200, status: 'PENDING', method: 'UPI' },
    { amount: 800, status: 'REJECTED', method: 'BANK' },
    { amount: 5400, status: 'PENDING', method: 'BANK' },
    { amount: 2600, status: 'PAID', method: 'UPI' },
    { amount: 7100, status: 'PENDING', method: 'BANK' },
    { amount: 1900, status: 'REJECTED', method: 'UPI' },
  ].entries()) {
    await seedRow(prisma, 'payout', demoId('payout', index + 1), {
      vendorId: identity.vendorIds[index % 2 === 0 ? 'main' : 'second'],
      amount: payout.amount,
      method: payout.method,
      accountRef: 'demo-account-ref',
      status: payout.status as any,
      period: '2026-10',
      reference: `PAYOUT-DEMO-${index + 1}`,
      notes: 'Demo payout row',
      rejectReason: payout.status === 'REJECTED' ? 'Bank details missing' : '',
      requestedBy: identity.vendorUserIds[index % 2 === 0 ? 0 : 1],
      approvedBy: payout.status === 'PAID' ? identity.superAdminId : null,
      approvedAt: payout.status === 'PAID' ? daysFromNow(-7) : null,
      processedAt: payout.status === 'PAID' ? daysFromNow(-6) : null,
    });
  }

  return paymentIds;
};

/** Creates return, exchange and refund requests against delivered orders. */
const seedReturns = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
  orderItemIds: string[],
  orderIds: string[],
): Promise<string[]> => {
  const reasons = await prisma.returnReason.findMany({ select: { id: true }, take: 3 });
  const returnRequestIds: string[] = [];

  for (const [index, returnSeed] of [
    { status: 'REFUNDED', type: 'REFUND', qty: 1 },
    { status: 'APPROVED', type: 'EXCHANGE', qty: 1 },
    { status: 'REQUESTED', type: 'REPLACEMENT', qty: 1 },
    { status: 'APPROVED', type: 'REFUND', qty: 1 },
    { status: 'REJECTED', type: 'EXCHANGE', qty: 1 },
    { status: 'REQUESTED', type: 'REFUND', qty: 1 },
    { status: 'APPROVED', type: 'REPLACEMENT', qty: 1 },
  ].entries()) {
    const row = await seedRowBy(
      prisma,
      'returnRequest',
      { returnNumber: `RET-DEMO-${2001 + index}` },
      demoId('return-request', index + 1),
      {
        returnNumber: `RET-DEMO-${2001 + index}`,
        orderId: orderIds[index % orderIds.length],
        userId: identity.customerIds[index % identity.customerIds.length],
        vendorId: identity.vendorIds[index % 2 === 0 ? 'main' : 'second'],
        reasonId: reasons[index % reasons.length]?.id ?? null,
        reasonText: 'Demo return reason',
        type: returnSeed.type as any,
        status: returnSeed.status as any,
        images: [`https://picsum.photos/seed/return-${index + 1}/400/400`],
        comment: 'Created by the local seed for testing.',
        pickupAddress: { line1: '123 Main Street', city: 'New Delhi', pincode: '110001' },
        refundAmount: index === 0 ? 799 : 0,
        refundMode: 'ORIGINAL',
        requestedAt: daysFromNow(-6),
        refundedAt: index === 0 ? daysFromNow(-2) : null,
      },
    );
    returnRequestIds.push(row.id);

    const orderItemId = orderItemIds[index % orderItemIds.length];
    if (orderItemId) {
      await seedRow(prisma, 'returnItem', demoId('return-item', index + 1), {
        returnRequestId: row.id,
        orderItemId,
        qty: returnSeed.qty,
        refundAmount: index === 0 ? 799 : 0,
      });
    }

    const productId = catalog.productIds[index % catalog.productIds.length];
    await seedRow(prisma, 'exchangeItem', demoId('exchange-item', index + 1), {
      returnRequestId: row.id,
      productId,
      qty: 1,
      status: 'PENDING',
      userId: identity.customerIds[index % identity.customerIds.length],
      orderId: orderIds[index % orderIds.length],
      orderItemId: orderItemId ?? null,
    });
  }

  return returnRequestIds;
};

/** Adds shipments, deliveries and the replay guards behind the money routes. */
const seedFulfilment = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  orderIds: string[],
  subOrderIds: string[],
): Promise<void> => {
  const standard = await prisma.shippingMethod.findUnique({ where: { code: 'STANDARD' } });
  const express = await prisma.shippingMethod.findUnique({ where: { code: 'EXPRESS' } });
  const partner = await prisma.shippingPartner.findUnique({ where: { code: 'bluedart' } });

  for (const [index, subOrderId] of subOrderIds.entries()) {
    const shipment = await seedRow(prisma, 'shipment', demoId('shipment', index + 1), {
      subOrderId,
      orderId: orderIds[index],
      methodId: index % 2 === 0 ? (standard?.id ?? null) : (express?.id ?? null),
      partnerId: partner?.id ?? null,
      awb: `AWB-DEMO-${index + 1}0001`,
      trackingUrl: `https://tracking.example.com/AWB-DEMO-${index + 1}0001`,
      status: index === 0 ? 'DELIVERED' : index === 1 ? 'IN_TRANSIT' : 'LABEL_CREATED',
      weight: 0.5 + index * 0.2,
      charge: 49 + index * 25,
      pickupAddress: { line1: 'Ravi Store Warehouse', city: 'New Delhi', pincode: '110001' },
      deliveryAddress: { line1: '123 Main Street', city: 'New Delhi', pincode: '110001' },
      estimatedDays: 3 + index,
      shippedAt: index < 2 ? daysFromNow(-4) : null,
      deliveredAt: index === 0 ? daysFromNow(-1) : null,
      remarks: 'Demo shipment',
    });

    await seedRow(prisma, 'delivery', demoId('delivery', index + 1), {
      shipmentId: shipment.id,
      subOrderId,
      deliveryBoyId: identity.deliveryBoyIds[index % identity.deliveryBoyIds.length],
      status: index === 0 ? 'DELIVERED' : index === 1 ? 'OUT_FOR_DELIVERY' : 'PENDING',
      deliveryOtp: '1234',
      otpVerifiedAt: index === 0 ? daysFromNow(-1) : null,
      latitude: 28.6139,
      longitude: 77.209,
      remarks: 'Demo delivery',
      pickupCode: `PICK-${index + 1}`,
      deliveredAt: index === 0 ? daysFromNow(-1) : null,
    });
  }

  for (const [index, idempotency] of [
    { key: 'demo-idem-order', scope: 'order:place', state: 'COMPLETED' },
    { key: 'demo-idem-payment', scope: 'payment:create', state: 'COMPLETED' },
    { key: 'demo-idem-refund', scope: 'refund:create', state: 'IN_PROGRESS' },
  ].entries()) {
    await prisma.idempotencyKey.upsert({
      where: { userId_key: { userId: identity.customerIds[index], key: idempotency.key } },
      create: {
        userId: identity.customerIds[index],
        key: idempotency.key,
        scope: idempotency.scope,
        requestHash: `demo-request-hash-${index + 1}`,
        responseStatus: idempotency.state === 'COMPLETED' ? 201 : null,
        responseBody:
          idempotency.state === 'COMPLETED'
            ? '{"status":true,"message":"Created.","result":{}}'
            : null,
        state: idempotency.state,
        expiresAt: daysFromNow(1),
      },
      update: {},
    });
  }
};

/** Fills the carts, saved lists, wishlists and price watches. */ const seedShopping = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
): Promise<void> => {
  const productSlugs = Object.keys(catalog.productIdBySlug);

  for (const [index, customerId] of identity.customerIds.slice(0, 7).entries()) {
    const cart = await seedRowBy(
      prisma,
      'cart',
      { userId: customerId },
      demoId('cart', index + 1),
      {
        userId: customerId,
        sessionKey: `demo-session-${index + 1}`,
      },
    );

    for (const [itemIndex, slug] of productSlugs.slice(0, 2).entries()) {
      const productId = catalog.productIdBySlug[slug];
      const variantId = catalog.variantIds[(index + itemIndex) % catalog.variantIds.length] ?? null;
      if (!productId) continue;
      await seedRow(prisma, 'cartItem', demoId(`cart-${index + 1}-item`, itemIndex + 1), {
        cartId: cart.id,
        productId,
        variantId,
        qty: itemIndex + 1,
        price: 499 + itemIndex * 300,
        userId: customerId,
      });
    }

    const wishlist = await seedRowBy(
      prisma,
      'wishlist',
      { userId: customerId },
      demoId('wishlist', index + 1),
      { userId: customerId },
    );

    for (const [itemIndex, slug] of productSlugs.slice(1, 3).entries()) {
      const productId = catalog.productIdBySlug[slug];
      if (!productId) continue;
      await seedRow(prisma, 'wishlistItem', demoId(`wishlist-${index + 1}-item`, itemIndex + 1), {
        wishlistId: wishlist.id,
        productId,
        userId: customerId,
      });
    }
  }

  for (const [index, slug] of productSlugs.slice(0, 7).entries()) {
    const productId = catalog.productIdBySlug[slug];
    if (!productId) continue;
    await seedRow(prisma, 'savedCartItem', demoId('saved-cart-item', index + 1), {
      userId: identity.customerIds[0],
      productId,
      variantId: null,
      qty: index + 1,
    });

    await seedRow(prisma, 'priceWatch', demoId('price-watch', index + 1), {
      userId: identity.customerIds[0],
      productId,
      targetPrice: 400 + index * 100,
      lastSeenPrice: 499 + index * 100,
      isActive: true,
    });
  }
};

/** Adds reviews and product questions answered by the vendor. */
const seedEngagement = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
): Promise<void> => {
  const reviewSeeds = [
    {
      slug: 'classic-cotton-shirt',
      customerIndex: 0,
      rating: 5,
      title: 'Great fit',
      comment: 'Fabric feels premium and the fit is true to size.',
      status: 'APPROVED',
    },
    {
      slug: 'classic-cotton-shirt',
      customerIndex: 1,
      rating: 4,
      title: 'Good value',
      comment: 'Colour is slightly darker than the photo.',
      status: 'APPROVED',
    },
    {
      slug: 'smart-watch-pro',
      customerIndex: 2,
      rating: 5,
      title: 'Battery lasts',
      comment: 'Seven days of battery even with workouts.',
      status: 'APPROVED',
    },
    {
      slug: 'slim-fit-trousers',
      customerIndex: 3,
      rating: 4,
      title: 'Comfortable',
      comment: 'Nice cut, needs a belt.',
      status: 'PENDING',
    },
    { slug: 'fitness-band-lite', customerIndex: 4, rating: 5, title: 'Lightweight and accurate', comment: 'Comfortable band with useful daily activity tracking.', status: 'APPROVED' },
    { slug: 'wireless-headphones', customerIndex: 5, rating: 4, title: 'Clear sound', comment: 'Good sound quality for calls and music.', status: 'APPROVED' },
    { slug: 'cotton-t-shirt', customerIndex: 6, rating: 5, title: 'Soft fabric', comment: 'Comfortable fabric and good stitching.', status: 'PENDING' },
  ];

  for (const [index, review] of reviewSeeds.entries()) {
    const productId = catalog.productIdBySlug[review.slug];
    if (!productId) continue;
    await prisma.review.upsert({
      where: {
        productId_userId: { productId, userId: identity.customerIds[review.customerIndex] },
      },
      create: {
        productId,
        userId: identity.customerIds[review.customerIndex],
        vendorId: identity.vendorIds[index < 2 ? 'main' : index === 2 ? 'second' : 'main'],
        orderItemId: null,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        images: [],
        isVerified: true,
        status: review.status as any,
        vendorReply: index === 0 ? 'Thanks for the kind words!' : '',
        repliedAt: index === 0 ? daysFromNow(-2) : null,
        repliedById: index === 0 ? identity.vendorUserIds[0] : null,
        createdAt: daysFromNow(-5 - index),
      },
      update: {},
    });
  }

  const questionSeeds = [
    { slug: 'classic-cotton-shirt', question: 'Does it shrink after washing?' },
    { slug: 'smart-watch-pro', question: 'Can it answer phone calls?' },
    { slug: 'bluetooth-speaker-mini', question: 'Is it waterproof?' },
    { slug: 'fitness-band-lite', question: 'Does it track sleep automatically?' },
    { slug: 'wireless-headphones', question: 'Does it support multipoint pairing?' },
    { slug: 'cotton-t-shirt', question: 'Is the fabric pre-shrunk?' },
    { slug: 'slim-fit-trousers', question: 'Is the waist adjustable?' },
  ];

  for (const [index, seed] of questionSeeds.entries()) {
    const productId = catalog.productIdBySlug[seed.slug];
    if (!productId) continue;
    const question = await seedRow(prisma, 'question', demoId('question', index + 1), {
      productId,
      userId: identity.customerIds[index % identity.customerIds.length],
      vendorId: index < 1 ? identity.vendorIds.main : identity.vendorIds.second,
      question: seed.question,
      isApproved: true,
      isAnonymous: index % 2 === 0,
      createdAt: daysFromNow(-4 - index),
    });

    await seedRow(prisma, 'answer', demoId('answer', index + 1), {
      questionId: question.id,
      userId: identity.vendorUserIds[index < 1 ? 0 : 1],
      answer: 'Yes, please check the product description for the full details.',
      isApproved: true,
    });
  }
};

/** Seeds every commerce row and returns the ids later stages reference. */
export const seedCommerce = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  catalog: CatalogContext,
): Promise<CommerceContext> => {
  const orders = await seedOrders(prisma, identity, catalog);
  await seedOrderExtras(prisma, identity, orders.orderIds);
  const paymentIds = await seedMoney(prisma, identity, orders.orderIds, orders.subOrderIds);
  const returnRequestIds = await seedReturns(
    prisma,
    identity,
    catalog,
    orders.orderItemIds,
    orders.orderIds,
  );
  await seedShopping(prisma, identity, catalog);
  await seedEngagement(prisma, identity, catalog);
  await seedFulfilment(prisma, identity, orders.orderIds, orders.subOrderIds);

  // eslint-disable-next-line no-console
  console.log('[seed]   commerce (orders, payments, payouts, returns, shipping, wishlist) — done');

  return {
    orderIds: orders.orderIds,
    orderItemIds: orders.orderItemIds,
    subOrderIds: orders.subOrderIds,
    paymentIds,
    returnRequestIds,
  };
};
