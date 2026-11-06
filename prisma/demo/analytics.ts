/**
 * Seeds the tracking and analytics tables so every dashboard endpoint has a
 * time series to aggregate instead of returning zeros.
 */
import { PrismaClient } from '@prisma/client';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { IdentityContext } from './types';

/** Adds visitor events, page views, custom events and crash reports. */
const seedTracking = async (prisma: PrismaClient, identity: IdentityContext): Promise<void> => {
  for (const [index, event] of [
    { eventType: 'page_view', eventName: 'home', pageUrl: '/' },
    { eventType: 'product_view', eventName: 'product', pageUrl: '/products/classic-cotton-shirt' },
    { eventType: 'add_to_cart', eventName: 'cart', pageUrl: '/cart' },
    { eventType: 'search', eventName: 'search', pageUrl: '/search?q=shirt' },
    { eventType: 'category_view', eventName: 'category', pageUrl: '/categories/electronics' },
    { eventType: 'checkout_started', eventName: 'checkout', pageUrl: '/checkout' },
    { eventType: 'purchase', eventName: 'purchase', pageUrl: '/orders/confirmation' },
  ].entries()) {
    await seedRow(prisma, 'visitorLog', demoId('visitor-log', index + 1), {
      sessionKey: `demo-session-${index + 1}`,
      deviceId: `demo-device-${index + 1}`,
      userId: identity.customerIds[index % identity.customerIds.length],
      eventType: event.eventType,
      eventName: event.eventName,
      eventData: { source: 'demo-seed' },
      pageUrl: event.pageUrl,
      referrer: index % 2 === 0 ? 'https://google.com' : '',
      utm: { source: 'google', medium: 'cpc' },
      geo: { country: 'IN', city: 'New Delhi' },
      platform: index === 1 ? 'ANDROID' : 'WEB',
      isBot: false,
      ip: '127.0.0.1',
      createdAt: daysFromNow(-index),
    });

    await seedRow(prisma, 'pageView', demoId('page-view', index + 1), {
      sessionKey: `demo-session-${index + 1}`,
      pageUrl: event.pageUrl,
      pageTitle: event.eventName,
      timeOnPage: 30 + index * 15,
      scrollDepth: 40 + index * 10,
      referrer: 'https://google.com',
      deviceType: index === 1 ? 'mobile' : 'desktop',
      platform: index === 1 ? 'ANDROID' : 'WEB',
      geo: { country: 'IN', city: 'New Delhi' },
      createdAt: daysFromNow(-index),
    });

    await seedRow(prisma, 'event', demoId('event-row', index + 1), {
      sessionKey: `demo-session-${index + 1}`,
      name: event.eventName,
      meta: { source: 'demo-seed' },
      deviceId: `demo-device-${index + 1}`,
      userId: identity.customerIds[index % identity.customerIds.length],
      createdAt: daysFromNow(-index),
    });
  }

  for (const [index, crash] of [
    { errorMessage: 'TypeError: undefined is not a function', platform: 'ANDROID' },
    { errorMessage: 'RangeError: invalid time value', platform: 'IOS' },
    { errorMessage: 'NetworkError: failed to fetch', platform: 'WEB' },
    { errorMessage: 'TypeError: cannot read property id', platform: 'ANDROID' },
    { errorMessage: 'NetworkError: request timed out', platform: 'IOS' },
    { errorMessage: 'RangeError: maximum call stack exceeded', platform: 'WEB' },
    { errorMessage: 'TypeError: cannot read property price', platform: 'ANDROID' },
  ].entries()) {
    await seedRow(prisma, 'crashLog', demoId('crash-log', index + 1), {
      deviceId: `demo-device-${index + 1}`,
      platform: crash.platform as any,
      appVersion: '1.2.0',
      errorMessage: crash.errorMessage,
      errorType: crash.errorMessage.split(':')[0],
      stack: 'at demo (app.js:1:1)',
      breadcrumbs: [{ action: 'open-screen', screen: 'home' }],
      meta: { source: 'demo-seed' },
      sessionKey: `demo-session-${index + 1}`,
      userId: identity.customerIds[index % identity.customerIds.length],
      createdAt: daysFromNow(-index),
    });
  }
};

/** Adds the checkout funnel and the sessions that converted through it. */
const seedFunnels = async (prisma: PrismaClient): Promise<void> => {
  for (const [index, funnel] of [
    { name: 'Checkout', slug: 'demo-checkout', description: 'Home to paid order' },
    { name: 'Signup', slug: 'demo-signup', description: 'Visit to verified account' },
    { name: 'Product discovery', slug: 'demo-product-discovery', description: 'Search to cart' },
    { name: 'Repeat purchase', slug: 'demo-repeat-purchase', description: 'Returning visit to repeat order' },
    { name: 'Campaign landing', slug: 'demo-campaign-landing', description: 'Campaign visit to conversion' },
    { name: 'Mobile checkout', slug: 'demo-mobile-checkout', description: 'Mobile product view to paid order' },
    { name: 'Vendor discovery', slug: 'demo-vendor-discovery', description: 'Vendor profile to product order' },
  ].entries()) {
    const row = await seedRowBy(
      prisma,
      'funnel',
      { slug: funnel.slug },
      demoId('funnel', index + 1),
      { ...funnel, isActive: true },
    );

    const steps = [
      { name: 'Landing', eventName: 'page_view' },
      { name: 'Product', eventName: 'product_view' },
      { name: 'Cart', eventName: 'add_to_cart' },
      { name: 'Checkout', eventName: 'order_placed' },
    ];

    for (const [stepIndex, step] of steps.entries()) {
      const stepRow = await seedRow(
        prisma,
        'funnelStep',
        demoId(`funnel-${index + 1}-step`, stepIndex + 1),
        {
          funnelId: row.id,
          name: step.name,
          eventName: step.eventName,
          sortOrder: stepIndex,
          count: 1000 - stepIndex * 200,
          dropOff: stepIndex * 50,
        },
      );

      if (stepIndex === 0) {
        for (const conversionIndex of [0, 1]) {
          await seedRow(
            prisma,
            'funnelConversion',
            demoId(`funnel-${index + 1}-conversion`, conversionIndex + 1),
            {
              funnelId: row.id,
              stepId: stepRow.id,
              sessionKey: `demo-session-${conversionIndex + 1}`,
              userId: '',
              createdAt: daysFromNow(-conversionIndex),
            },
          );
        }
      }
    }
  }
};

/** Adds daily rollups and per-city visit counts. */
const seedRollups = async (prisma: PrismaClient): Promise<void> => {
  for (const [index, date] of [
    '2026-10-28T00:00:00.000Z',
    '2026-10-29T00:00:00.000Z',
    '2026-10-30T00:00:00.000Z',
    '2026-10-31T00:00:00.000Z',
    '2026-11-01T00:00:00.000Z',
    '2026-11-02T00:00:00.000Z',
    '2026-11-03T00:00:00.000Z',
  ].entries()) {
    await seedRowBy(
      prisma,
      'analyticsDaily',
      { date: new Date(date) },
      demoId('analytics-daily', index + 1),
      {
        date: new Date(date),
        visitors: 800 + index * 45,
        uniqueVisitors: 520 + index * 30,
        pageViews: 2400 + index * 120,
        sessions: 700 + index * 40,
        newUsers: 90 + index * 10,
        orders: 40 + index * 5,
        revenue: 52000 + index * 4200,
        conversions: 35 + index * 4,
        bounces: 210 - index * 5,
        avgSessionDuration: 180 + index * 12,
        deviceBreakdown: { android: 55, ios: 30, web: 15 },
        geoBreakdown: { IN: 80, AE: 12, US: 8 },
        trafficSources: { organic: 45, paid: 30, direct: 25 },
      },
    );
  }

  for (const [index, visit] of [
    {
      date: '2026-10-28',
      country: 'IN',
      state: 'DL',
      city: 'New Delhi',
      visitors: 420,
      pageViews: 1300,
    },
    {
      date: '2026-10-29',
      country: 'IN',
      state: 'MH',
      city: 'Mumbai',
      visitors: 310,
      pageViews: 980,
    },
    { date: '2026-10-30', country: 'AE', state: 'DU', city: 'Dubai', visitors: 90, pageViews: 260 },
    {
      date: '2026-10-31',
      country: 'US',
      state: 'CA',
      city: 'Los Angeles',
      visitors: 60,
      pageViews: 190,
    },
    { date: '2026-11-01', country: 'IN', state: 'KA', city: 'Bengaluru', visitors: 240, pageViews: 720 },
    { date: '2026-11-02', country: 'AE', state: 'DU', city: 'Abu Dhabi', visitors: 70, pageViews: 210 },
    { date: '2026-11-03', country: 'US', state: 'NY', city: 'New York', visitors: 85, pageViews: 260 },
  ].entries()) {
    const date = new Date(`${visit.date}T00:00:00.000Z`);
    await prisma.geoVisit.upsert({
      where: {
        date_country_state_city: {
          date,
          country: visit.country,
          state: visit.state,
          city: visit.city,
        },
      },
      create: {
        date,
        country: visit.country,
        state: visit.state,
        city: visit.city,
        visitors: visit.visitors,
        pageViews: visit.pageViews,
      },
      update: {},
    });
    void index;
  }
};

/** Seeds every tracking and analytics row. */
export const seedAnalyticsModule = async (
  prisma: PrismaClient,
  identity: IdentityContext,
): Promise<void> => {
  await seedTracking(prisma, identity);
  await seedFunnels(prisma);
  await seedRollups(prisma);

  // eslint-disable-next-line no-console
  console.log('[seed]   analytics (visitor logs, page views, funnels, rollups) — done');
};
