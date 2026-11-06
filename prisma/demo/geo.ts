/**
 * Seeds the reference data every other module hangs off: countries, currencies,
 * tax rates and the shipping network.
 *
 * Rows the base seed already owns are matched by their natural key so this file
 * only adds the extra values the demo flows need.
 */
import { PrismaClient } from '@prisma/client';
import { demoId, seedRow, seedRowBy } from './helpers';
import type { GeoContext } from './types';

/** Adds the extra countries, states, cities and currencies the demo uses. */
const seedLocations = async (prisma: PrismaClient): Promise<void> => {
  const extraCountries = [
    { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', currency: 'AED' },
    { code: 'GB', name: 'United Kingdom', dialCode: '+44', currency: 'GBP' },
    { code: 'DE', name: 'Germany', dialCode: '+49', currency: 'EUR' },
    { code: 'SG', name: 'Singapore', dialCode: '+65', currency: 'SGD' },
    { code: 'AU', name: 'Australia', dialCode: '+61', currency: 'AUD' },
    { code: 'US', name: 'United States', dialCode: '+1', currency: 'USD' },
  ];
  for (const country of extraCountries) {
    await seedRowBy(prisma, 'country', { code: country.code }, demoId('country', country.code.toLowerCase()), country);
  }

  const states: Array<{ code: string; name: string; countryCode: string }> = [
    { code: 'CA', name: 'California', countryCode: 'US' },
    { code: 'NY', name: 'New York', countryCode: 'US' },
    { code: 'ENG', name: 'England', countryCode: 'GB' },
    { code: 'BE', name: 'Berlin', countryCode: 'DE' },
  ];
  for (const [index, state] of states.entries()) {
    await seedRowBy(prisma, 'state', { code: state.code }, demoId('state', index + 1), {
      countryCode: state.countryCode,
      code: state.code,
      name: state.name,
    });
  }

  for (const [index, city] of [
    { stateCode: 'CA', name: 'Los Angeles', pincode: '90001', latitude: 34.05, longitude: -118.24 },
    { stateCode: 'NY', name: 'New York', pincode: '10001', latitude: 40.71, longitude: -74.0 },
    { stateCode: 'ENG', name: 'London', pincode: 'SW1A 1AA', latitude: 51.51, longitude: -0.13 },
    { stateCode: 'BE', name: 'Berlin', pincode: '10115', latitude: 52.52, longitude: 13.4 },
  ].entries()) {
    await seedRow(prisma, 'city', demoId('city', index + 1), city);
  }

  for (const currency of [
    {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimals: 2,
      rate: 83.2,
      isDefault: false,
    },
    { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, rate: 90.1, isDefault: false },
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2, rate: 22.65, isDefault: false },
    { code: 'GBP', name: 'Pound Sterling', symbol: '£', decimals: 2, rate: 105.2, isDefault: false },
    { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, rate: 62.1, isDefault: false },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, rate: 54.5, isDefault: false },
  ]) {
    await seedRowBy(
      prisma,
      'currency',
      { code: currency.code },
      demoId('currency', currency.code.toLowerCase()),
      { ...currency, isActive: true },
    );
  }
};

/** Adds a zero-rate tax row alongside the three GST slabs the base seed owns. */
const seedTax = async (prisma: PrismaClient): Promise<string> => {
  const row = await seedRowBy(prisma, 'taxConfig', { slug: 'gst-0' }, demoId('tax', 'gst-0'), {
    name: 'GST 0%',
    slug: 'gst-0',
    percent: 0,
    cgstPercent: 0,
    sgstPercent: 0,
    igstPercent: 0,
    isActive: true,
  });
  for (const tax of [
    { name: 'GST 3%', slug: 'gst-3', percent: 3, cgstPercent: 1.5, sgstPercent: 1.5, igstPercent: 3 },
    { name: 'GST 28%', slug: 'gst-28', percent: 28, cgstPercent: 14, sgstPercent: 14, igstPercent: 28 },
    { name: 'GST 0.25%', slug: 'gst-0-25', percent: 0.25, cgstPercent: 0.125, sgstPercent: 0.125, igstPercent: 0.25 },
  ]) {
    await seedRowBy(prisma, 'taxConfig', { slug: tax.slug }, demoId('tax', tax.slug), {
      ...tax, isInclusive: false, isActive: true,
    });
  }
  return row.id;
};

/** Adds the shipping zones, methods and partners the order demo ships through. */
const seedShipping = async (
  prisma: PrismaClient,
): Promise<
  Pick<
    GeoContext,
    'shippingZoneId' | 'shippingMethodId' | 'expressShippingMethodId' | 'shippingPartnerId'
  >
> => {
  const indiaZone = await prisma.shippingZone.findUnique({ where: { id: 'seed-zone-india' } });
  const zoneId =
    indiaZone?.id ??
    (
      await seedRow(prisma, 'shippingZone', demoId('zone', 'india'), {
        name: 'India',
        countries: ['IN'],
        states: ['DL', 'MH', 'KA', 'UP', 'TN', 'GJ'],
        pincodes: [],
        isActive: true,
      })
    ).id;

  await seedRow(prisma, 'shippingZone', demoId('zone', 'gulf'), {
    name: 'Gulf',
    countries: ['AE'],
    states: [],
    pincodes: [],
    isActive: true,
  });

  await seedRow(prisma, 'shippingZone', demoId('zone', 'europe'), {
    name: 'Europe', countries: ['GB', 'DE', 'FR'], states: [], pincodes: [], isActive: true,
  });
  for (const zone of [
    { key: 'americas', name: 'Americas', countries: ['US', 'CA'] },
    { key: 'asia-pacific', name: 'Asia Pacific', countries: ['SG', 'AU'] },
    { key: 'united-kingdom', name: 'United Kingdom', countries: ['GB'] },
    { key: 'middle-east', name: 'Middle East', countries: ['AE', 'SA', 'QA'] },
  ]) {
    await seedRow(prisma, 'shippingZone', demoId('zone', zone.key), {
      name: zone.name, countries: zone.countries, states: [], pincodes: [], isActive: true,
    });
  }

  const methods: Array<{ code: string; data: Record<string, any> }> = [
    {
      code: 'SAME_DAY',
      data: {
        name: 'Same Day',
        baseCharge: 149,
        perKgCharge: 10,
        freeAbove: 4999,
        minDays: 0,
        maxDays: 1,
        isCodAllowed: false,
        isActive: true,
        zoneId,
      },
    },
    {
      code: 'INTERNATIONAL',
      data: { name: 'International', baseCharge: 999, perKgCharge: 250, freeAbove: 0, minDays: 7, maxDays: 15, isCodAllowed: false, isActive: true, zoneId },
    },
    { code: 'ECONOMY', data: { name: 'Economy', baseCharge: 29, perKgCharge: 8, freeAbove: 1499, minDays: 5, maxDays: 9, isCodAllowed: true, isActive: true, zoneId } },
    { code: 'NEXT_DAY', data: { name: 'Next Day', baseCharge: 199, perKgCharge: 15, freeAbove: 4999, minDays: 1, maxDays: 1, isCodAllowed: false, isActive: true, zoneId } },
    { code: 'PICKUP', data: { name: 'Store Pickup', baseCharge: 0, perKgCharge: 0, freeAbove: 0, minDays: 0, maxDays: 2, isCodAllowed: false, isActive: true, zoneId } },
  ];

  for (const method of methods) {
    await seedRowBy(
      prisma,
      'shippingMethod',
      { code: method.code },
      demoId('shipping-method', method.code.toLowerCase()),
      { ...method.data, code: method.code },
    );
  }

  const partners: Array<{ code: string; name: string }> = [
    { code: 'bluedart', name: 'Blue Dart' },
    { code: 'delhivery', name: 'Delhivery' },
    { code: 'ecom-express', name: 'Ecom Express' },
    { code: 'dtdc', name: 'DTDC' },
    { code: 'india-post', name: 'India Post' },
    { code: 'fedex-demo', name: 'FedEx Demo' },
  ];

  for (const partner of partners) {
    await seedRowBy(
      prisma,
      'shippingPartner',
      { code: partner.code },
      demoId('shipping-partner', partner.code),
      { ...partner, isActive: true },
    );
  }

  const standard = await prisma.shippingMethod.findUnique({ where: { code: 'STANDARD' } });
  const express = await prisma.shippingMethod.findUnique({ where: { code: 'EXPRESS' } });
  const blueDart = await prisma.shippingPartner.findUnique({ where: { code: 'bluedart' } });

  return {
    shippingZoneId: zoneId,
    shippingMethodId: standard?.id ?? '',
    expressShippingMethodId: express?.id ?? '',
    shippingPartnerId: blueDart?.id ?? '',
  };
};

/** Adds the extra dropdown options and translations the demo screens render. */
const seedReferenceValues = async (prisma: PrismaClient): Promise<void> => {
  for (const dropdown of [
    { type: 'RETURN_REASON', label: 'Wrong size', value: 'wrong-size' },
    { type: 'RETURN_REASON', label: 'Damaged', value: 'damaged' },
    { type: 'BLOG_CATEGORY', label: 'Style Guide', value: 'style-guide' },
    { type: 'BLOG_CATEGORY', label: 'Product News', value: 'product-news' },
  ]) {
    await prisma.dropdown.upsert({
      where: { type_value: { type: dropdown.type, value: dropdown.value } },
      create: dropdown,
      update: {},
    });
  }

  for (const [index, entry] of [
    { locale: 'en', key: 'home.hero', value: 'Shop the latest arrivals' },
    { locale: 'hi', key: 'home.hero', value: 'नई लॉन्च कलेक्शन खरीदें' },
    { locale: 'en', key: 'home.shipping', value: 'Free shipping on eligible orders' },
    { locale: 'hi', key: 'home.shipping', value: 'चयनित ऑर्डर पर निःशुल्क डिलीवरी' },
    { locale: 'en', key: 'cart.checkout', value: 'Proceed to checkout' },
    { locale: 'hi', key: 'cart.checkout', value: 'चेकआउट के लिए आगे बढ़ें' },
    { locale: 'en', key: 'order.track', value: 'Track your order' },
  ].entries()) {
    await prisma.translation.upsert({
      where: {
        locale_key_namespace: { locale: entry.locale, key: entry.key, namespace: 'common' },
      },
      create: { ...entry, namespace: 'common' },
      update: {},
    });
    void index;
  }
};

/** Seeds every geo/config row and returns the ids later stages reference. */
export const seedGeo = async (prisma: PrismaClient): Promise<GeoContext> => {
  await seedLocations(prisma);
  const taxConfigId = await seedTax(prisma);
  const shipping = await seedShipping(prisma);
  await seedReferenceValues(prisma);

  // eslint-disable-next-line no-console
  console.log('[seed]   geo (countries, states, cities, currency, tax, shipping) — done');

  return {
    countryCode: 'IN',
    currencyCode: 'INR',
    taxConfigId,
    ...shipping,
  };
};
