/**
 * Seeds the demo people: customers, vendors, delivery partners and the auth
 * artefacts their sessions leave behind.
 *
 * The base seed owns the super admin, one sub-admin, one vendor and one
 * customer. This file adds enough of each role that every list endpoint has
 * more than one row and every role filter has something to match.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { IdentityContext } from './types';

const DEMO_PASSWORD = 'Demo@12345';

interface DemoPerson {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'CUSTOMER' | 'VENDOR' | 'DELIVERY_BOY' | 'SUB_ADMIN';
}

const PEOPLE: DemoPerson[] = [
  {
    id: demoId('user', 'customer-2'),
    email: 'customer2@projectname.com',
    name: 'Priya Verma',
    phone: '+919812345679',
    role: 'CUSTOMER',
  },
  {
    id: demoId('user', 'customer-3'),
    email: 'customer3@projectname.com',
    name: 'Rahul Singh',
    phone: '+919812345680',
    role: 'CUSTOMER',
  },
  {
    id: demoId('user', 'customer-4'),
    email: 'customer4@projectname.com',
    name: 'Sneha Patel',
    phone: '+919812345681',
    role: 'CUSTOMER',
  },
  {
    id: demoId('user', 'vendor-2'),
    email: 'vendor2@projectname.com',
    name: 'Neha Gupta',
    phone: '+919812345682',
    role: 'VENDOR',
  },
  {
    id: demoId('user', 'vendor-3'),
    email: 'vendor3@projectname.com',
    name: 'Arjun Mehta',
    phone: '+919812345683',
    role: 'VENDOR',
  },
  {
    id: demoId('user', 'delivery-1'),
    email: 'delivery1@projectname.com',
    name: 'Suresh Yadav',
    phone: '+919812345684',
    role: 'DELIVERY_BOY',
  },
  {
    id: demoId('user', 'delivery-2'),
    email: 'delivery2@projectname.com',
    name: 'Vikram Rao',
    phone: '+919812345685',
    role: 'DELIVERY_BOY',
  },
  {
    id: demoId('user', 'delivery-3'),
    email: 'delivery3@projectname.com',
    name: 'Imran Khan',
    phone: '+919812345686',
    role: 'DELIVERY_BOY',
  },
  ...Array.from({ length: 3 }, (_, index): DemoPerson => ({
    id: demoId('user', `customer-${index + 5}`),
    email: `customer${index + 5}@projectname.com`,
    name: ['Aarav Nair', 'Isha Kapoor', 'Kabir Das'][index] ?? `Demo Customer ${index + 5}`,
    phone: `+919812345${687 + index}`,
    role: 'CUSTOMER',
  })),
  ...Array.from({ length: 5 }, (_, index): DemoPerson => ({
    id: demoId('user', `vendor-${index + 4}`),
    email: `vendor${index + 4}@projectname.com`,
    name: `Marketplace Seller ${index + 4}`,
    phone: `+919812346${100 + index}`,
    role: 'VENDOR',
  })),
  ...Array.from({ length: 4 }, (_, index): DemoPerson => ({
    id: demoId('user', `delivery-${index + 4}`),
    email: `delivery${index + 4}@projectname.com`,
    name: `Delivery Partner ${index + 4}`,
    phone: `+919812347${100 + index}`,
    role: 'DELIVERY_BOY',
  })),
  ...Array.from({ length: 6 }, (_, index): DemoPerson => ({
    id: demoId('user', `sub-admin-${index + 2}`),
    email: `subadmin${index + 2}@projectname.com`,
    name: `Operations Admin ${index + 2}`,
    phone: `+919812348${100 + index}`,
    role: 'SUB_ADMIN',
  })),
];

/** Creates the extra verified users that the demo marketplace needs. */
const seedUsers = async (prisma: PrismaClient, passwordHash: string): Promise<void> => {
  for (const person of PEOPLE) {
    await seedRowBy(prisma, 'user', { email: person.email }, person.id, {
      email: person.email,
      name: person.name,
      phone: person.phone,
      passwordHash,
      role: person.role,
      isActive: true,
      isEmailVerified: true,
      isPhoneVerified: true,
      lastLoginAt: daysFromNow(-1),
      lastLoginIp: '127.0.0.1',
    });
  }
  // eslint-disable-next-line no-console
  console.log('[seed]   users (' + PEOPLE.length + ') — done');
};

/** Creates vendor profiles for the extra vendor accounts. */
const seedVendors = async (
  prisma: PrismaClient,
  vendorUserIds: string[],
): Promise<IdentityContext['vendorIds']> => {
  const main = await prisma.vendorProfile.findUnique({ where: { userId: vendorUserIds[0] } });
  const mainId =
    main?.id ??
    (
      await seedRowBy(prisma, 'vendorProfile', { userId: vendorUserIds[0] }, demoId('vendor', 1), {
        userId: vendorUserIds[0],
        shopName: 'Ravi Store',
        slug: 'ravi-store',
        status: 'APPROVED',
        approvedAt: new Date(),
      })
    ).id;

  const second = await seedRowBy(
    prisma,
    'vendorProfile',
    { userId: vendorUserIds[1] },
    demoId('vendor', 2),
    {
      userId: vendorUserIds[1],
      shopName: 'TechNova Store',
      slug: 'technova-store',
      description: 'Gadgets, audio and smart accessories.',
      logo: 'https://picsum.photos/seed/technova-logo/200/200',
      banner: 'https://picsum.photos/seed/technova-banner/1200/300',
      gstNumber: '29ABCDE1234F1Z5',
      panNumber: 'ABCDE1234G',
      bankHolderName: 'Neha Gupta',
      bankAccountNo: '000987654321',
      bankIfsc: 'ICIC0000002',
      upiId: 'technova@upi',
      commissionRate: 12,
      status: 'APPROVED',
      isDocumentsSubmitted: true,
      documentsVerifiedAt: daysFromNow(-40),
      approvedAt: daysFromNow(-35),
      rating: 4.4,
      ratingCount: 21,
      totalSales: 48500,
      pendingAmount: 3200,
    },
  );

  const third = await seedRowBy(
    prisma,
    'vendorProfile',
    { userId: vendorUserIds[2] },
    demoId('vendor', 3),
    {
      userId: vendorUserIds[2],
      shopName: 'Urban Threads Store',
      slug: 'urban-threads-store',
      description: 'Streetwear and everyday fashion.',
      logo: 'https://picsum.photos/seed/urban-logo/200/200',
      gstNumber: '07ABCDE1234F1Z6',
      panNumber: 'ABCDE1234H',
      bankHolderName: 'Arjun Mehta',
      bankAccountNo: '000456789123',
      bankIfsc: 'HDFC0000456',
      upiId: 'urbanthreads@upi',
      commissionRate: 10,
      status: 'PENDING',
      isDocumentsSubmitted: true,
      rating: 0,
      ratingCount: 0,
    },
  );

  for (const [index, userId] of vendorUserIds.slice(3).entries()) {
    await seedRowBy(prisma, 'vendorProfile', { userId }, demoId('vendor', index + 4), {
      userId,
      shopName: `Demo Marketplace ${index + 4}`,
      slug: `demo-marketplace-${index + 4}`,
      description: 'Local demo seller account for marketplace workflow testing.',
      logo: `https://picsum.photos/seed/demo-marketplace-${index + 4}/200/200`,
      gstNumber: `29DEMO${String(index + 4).padStart(4, '0')}F1Z5`,
      panNumber: `DEMO${String(index + 4).padStart(5, '0')}`,
      bankHolderName: `Marketplace Seller ${index + 4}`,
      bankAccountNo: `000000000${index + 4}`,
      bankIfsc: 'HDFC0000001',
      upiId: `seller${index + 4}@upi`,
      commissionRate: 10 + (index % 4),
      status: index % 3 === 0 ? 'PENDING' : 'APPROVED',
      isDocumentsSubmitted: true,
      approvedAt: index % 3 === 0 ? null : daysFromNow(-15),
      rating: 4.0 + (index % 5) / 10,
      ratingCount: 4 + index,
    });
  }

  // eslint-disable-next-line no-console
  console.log('[seed]   vendor profiles — done');
  return { main: mainId, second: second.id, third: third.id };
};

/** Creates the delivery partner profiles behind the delivery-boy logins. */
const seedDeliveryBoys = async (
  prisma: PrismaClient,
  deliveryUserIds: string[],
): Promise<string[]> => {
  const profiles = [
    {
      userId: deliveryUserIds[0],
      name: 'Suresh Yadav',
      phone: '+919812345684',
      email: 'delivery1@projectname.com',
      vehicleType: 'BIKE',
      vehicleNo: 'DL 1S AB 1234',
      totalDelivered: 128,
      rating: 4.6,
    },
    {
      userId: deliveryUserIds[1],
      name: 'Vikram Rao',
      phone: '+919812345685',
      email: 'delivery2@projectname.com',
      vehicleType: 'SCOOTER',
      vehicleNo: 'KA 05 XY 5678',
      totalDelivered: 64,
      rating: 4.3,
    },
    {
      userId: deliveryUserIds[2],
      name: 'Imran Khan',
      phone: '+919812345686',
      email: 'delivery3@projectname.com',
      vehicleType: 'BIKE',
      vehicleNo: 'UP 32 CD 9012',
      totalDelivered: 32,
      rating: 4.1,
    },
    ...deliveryUserIds.slice(3).map((userId, index) => ({
      userId,
      name: `Delivery Partner ${index + 4}`,
      phone: `+919812347${100 + index}`,
      email: `delivery${index + 4}@projectname.com`,
      vehicleType: index % 2 === 0 ? 'BIKE' : 'SCOOTER',
      vehicleNo: `RJ 14 DP ${String(2000 + index).slice(-4)}`,
      totalDelivered: 12 + index * 7,
      rating: 4.0 + (index % 5) / 10,
    })),
  ];

  const ids: string[] = [];
  for (const [index, profile] of profiles.entries()) {
    const row = await seedRowBy(
      prisma,
      'deliveryBoy',
      { userId: profile.userId },
      demoId('delivery-boy', index + 1),
      { ...profile, isActive: true, currentLoad: index },
    );
    ids.push(row.id);
  }
  // eslint-disable-next-line no-console
  console.log('[seed]   delivery boys (' + ids.length + ') — done');
  return ids;
};

/** Ensures each demo customer has at least one shipping address. */
const seedAddresses = async (prisma: PrismaClient, customerIds: string[]): Promise<string[]> => {
  const existing = await prisma.address.findFirst({
    where: { userId: customerIds[0], isDefault: true },
    select: { id: true },
  });

  const mainAddressId =
    existing?.id ??
    (
      await seedRow(prisma, 'address', demoId('address', 1), {
        userId: customerIds[0],
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
      })
    ).id;

  await seedRow(prisma, 'address', demoId('address', 2), {
    userId: customerIds[0],
    type: 'WORK',
    fullName: 'Amit Sharma',
    phone: '+919812345678',
    line1: '45 Business Park',
    line2: 'Tower B, 3rd Floor',
    city: 'Gurugram',
    state: 'Haryana',
    stateCode: 'HR',
    country: 'India',
    countryCode: 'IN',
    pincode: '122001',
    isDefault: false,
  });

  const secondary = [
    {
      userId: customerIds[1],
      fullName: 'Priya Verma',
      phone: '+919812345679',
      line1: '78 Lake Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      stateCode: 'MH',
      pincode: '400001',
    },
    {
      userId: customerIds[2],
      fullName: 'Rahul Singh',
      phone: '+919812345680',
      line1: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      stateCode: 'KA',
      pincode: '560001',
    },
    {
      userId: customerIds[3],
      fullName: 'Sneha Patel',
      phone: '+919812345681',
      line1: '9 Riverfront Avenue',
      city: 'Ahmedabad',
      state: 'Gujarat',
      stateCode: 'GJ',
      pincode: '380001',
    },
    ...customerIds.slice(4).map((userId, index) => ({
      userId,
      fullName: ['Aarav Nair', 'Isha Kapoor', 'Kabir Das'][index] ?? `Demo Customer ${index + 5}`,
      phone: `+919812345${687 + index}`,
      line1: `${20 + index} Demo Market Road`,
      city: ['Chennai', 'Pune', 'Jaipur'][index] ?? 'New Delhi',
      state: ['Tamil Nadu', 'Maharashtra', 'Rajasthan'][index] ?? 'Delhi',
      stateCode: ['TN', 'MH', 'RJ'][index] ?? 'DL',
      pincode: ['600001', '411001', '302001'][index] ?? '110001',
    })),
  ];

  const ids = [mainAddressId];
  for (const [index, address] of secondary.entries()) {
    const row = await seedRow(prisma, 'address', demoId('address', index + 3), {
      ...address,
      type: 'HOME',
      country: 'India',
      countryCode: 'IN',
      isDefault: true,
    });
    ids.push(row.id);
  }

  // eslint-disable-next-line no-console
  console.log('[seed]   addresses (' + ids.length + ') — done');
  return ids;
};

/** Creates devices, sessions, tokens and consent rows for the demo accounts. */
const seedAuthArtefacts = async (
  prisma: PrismaClient,
  customerIds: string[],
  vendorUserIds: string[],
): Promise<void> => {
  const devices = [
    { userId: customerIds[0], deviceId: 'demo-device-android-1', platform: 'ANDROID' },
    { userId: customerIds[1], deviceId: 'demo-device-ios-1', platform: 'IOS' },
    { userId: customerIds[2], deviceId: 'demo-device-web-1', platform: 'WEB' },
    { userId: vendorUserIds[0], deviceId: 'demo-device-android-2', platform: 'ANDROID' },
    ...customerIds.slice(3).map((userId, index) => ({
      userId,
      deviceId: `demo-device-customer-${index + 4}`,
      platform: index % 2 === 0 ? 'ANDROID' : 'IOS',
    })),
    ...vendorUserIds.slice(1, 4).map((userId, index) => ({
      userId,
      deviceId: `demo-device-vendor-${index + 2}`,
      platform: 'WEB',
    })),
  ];

  for (const [index, device] of devices.entries()) {
    await seedRowBy(prisma, 'device', { deviceId: device.deviceId }, demoId('device', index + 1), {
      deviceId: device.deviceId,
      userId: device.userId,
      platform: device.platform,
      os: device.platform === 'IOS' ? 'iOS' : 'Android',
      osVersion: '14',
      browser: device.platform === 'WEB' ? 'Chrome' : '',
      browserVersion: device.platform === 'WEB' ? '121' : '',
      model: device.platform === 'WEB' ? '' : 'Pixel 7',
      manufacturer: device.platform === 'WEB' ? '' : 'Google',
      fcmToken: `demo-fcm-token-${index + 1}`,
      appVersion: '1.2.0',
      locale: 'en-IN',
      timezone: 'Asia/Kolkata',
      screenWidth: 1080,
      screenHeight: 2400,
      ip: '127.0.0.1',
      isTrusted: true,
    });
  }

  for (const [index, customerId] of customerIds.entries()) {
    const sessionKey = `demo-session-${index + 1}`;
    const row = await seedRowBy(prisma, 'session', { sessionKey }, demoId('session', index + 1), {
      sessionKey,
      userId: customerId,
      deviceId: `demo-device-${index + 1}`,
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (demo seed)',
      platform: index === 1 ? 'IOS' : 'WEB',
      geo: { country: 'IN', city: 'New Delhi' },
      isActive: true,
    });
    void row;

    await seedRowBy(
      prisma,
      'refreshToken',
      { tokenHash: `demo-refresh-token-hash-${index + 1}` },
      demoId('refresh-token', index + 1),
      {
        userId: customerId,
        tokenHash: `demo-refresh-token-hash-${index + 1}`,
        deviceId: `demo-device-${index + 1}`,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (demo seed)',
        expiresAt: daysFromNow(30),
      },
    );

    await seedRow(prisma, 'passwordHistory', demoId('password-history', index + 1), {
      userId: customerId,
      passwordHash: 'demo-password-hash',
    });

    for (const [consentIndex, type] of ['TERMS', 'PRIVACY', 'MARKETING'].entries()) {
      await prisma.userConsent.upsert({
        where: { userId_type_version: { userId: customerId, type, version: '1' } },
        create: {
          userId: customerId,
          type,
          version: '1',
          acceptedAt: daysFromNow(-20),
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (demo seed)',
        },
        update: {},
      });
      void consentIndex;
    }
  }

  const otps = [
    { identifier: 'customer2@projectname.com', type: 'LOGIN', channel: 'EMAIL' },
    { identifier: '+919812345680', type: 'PHONE_VERIFY', channel: 'SMS' },
    { identifier: 'vendor2@projectname.com', type: 'REGISTER', channel: 'EMAIL' },
  ];

  for (const otp of otps) {
    await prisma.otp.upsert({
      where: {
        identifier_type_channel: {
          identifier: otp.identifier,
          type: otp.type as any,
          channel: otp.channel as any,
        },
      },
      create: {
        identifier: otp.identifier,
        type: otp.type as any,
        channel: otp.channel as any,
        otpHash: 'demo-otp-hash',
        expiresAt: daysFromNow(1),
      },
      update: {},
    });
  }

  for (const [index, verification] of [
    { purpose: 'REGISTER', identifier: 'customer3@projectname.com', channel: 'EMAIL' },
    { purpose: 'LOGIN', identifier: 'customer4@projectname.com', channel: 'EMAIL' },
    { purpose: 'EMAIL_CHANGE', identifier: 'vendor2@projectname.com', channel: 'EMAIL' },
  ].entries()) {
    await seedRowBy(
      prisma,
      'authVerification',
      { tokenHash: `demo-verification-token-${index + 1}` },
      demoId('auth-verification', index + 1),
      {
        tokenHash: `demo-verification-token-${index + 1}`,
        purpose: verification.purpose as any,
        identifier: verification.identifier,
        channel: verification.channel as any,
        expiresAt: daysFromNow(1),
      },
    );
  }

  for (const [index, social] of [
    { provider: 'GOOGLE', providerId: 'demo-google-1', email: 'customer@projectname.com' },
    { provider: 'APPLE', providerId: 'demo-apple-1', email: 'customer2@projectname.com' },
    { provider: 'FACEBOOK', providerId: 'demo-facebook-1', email: 'customer3@projectname.com' },
  ].entries()) {
    await prisma.socialAccount.upsert({
      where: {
        provider_providerId: { provider: social.provider as any, providerId: social.providerId },
      },
      create: {
        userId: customerIds[index % customerIds.length],
        provider: social.provider as any,
        providerId: social.providerId,
        email: social.email,
      },
      update: {},
    });
  }

  for (const [index, vendorUserId] of vendorUserIds.entries()) {
    const vendor = await prisma.vendorProfile.findUnique({
      where: { userId: vendorUserId },
      select: { id: true },
    });
    if (!vendor) continue;

    for (const [docIndex, doc] of [
      { docType: 'GST', fileUrl: 'https://demo.local/kyc/gst.pdf' },
      { docType: 'PAN', fileUrl: 'https://demo.local/kyc/pan.pdf' },
    ].entries()) {
      await seedRow(prisma, 'kycDocument', demoId(`kyc-${index}-${docIndex}`, 0), {
        vendorId: vendor.id,
        docType: doc.docType,
        fileUrl: doc.fileUrl,
        number: `DEMO-${doc.docType}-${index + 1}`,
        isVerified: index === 0,
        verifiedAt: index === 0 ? daysFromNow(-10) : null,
      });
    }

    await seedRow(prisma, 'vendorAnnouncement', demoId('vendor-announcement', index + 1), {
      vendorId: vendor.id,
      title: index === 0 ? 'Payout cycle updated' : 'New category guidelines',
      message:
        index === 0
          ? 'Payouts now settle every 7 days instead of 14.'
          : 'Please review the updated listing guidelines.',
      status: 'ACTIVE',
      isPinned: index === 0,
      startsAt: daysFromNow(-5),
    });
  }

  // eslint-disable-next-line no-console
  console.log('[seed]   auth artefacts (devices, sessions, tokens, consents, KYC) — done');
};

/** Seeds every identity row and returns the ids later stages reference. */
export const seedIdentity = async (
  prisma: PrismaClient,
  superAdminId: string,
): Promise<IdentityContext> => {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await seedUsers(prisma, passwordHash);

  const customerEmails = [
    'customer@projectname.com',
    'customer2@projectname.com',
    'customer3@projectname.com',
    'customer4@projectname.com',
    'customer5@projectname.com',
    'customer6@projectname.com',
    'customer7@projectname.com',
  ];
  const vendorEmails = [
    'vendor@projectname.com',
    'vendor2@projectname.com',
    'vendor3@projectname.com',
    'vendor4@projectname.com',
    'vendor5@projectname.com',
    'vendor6@projectname.com',
    'vendor7@projectname.com',
    'vendor8@projectname.com',
  ];
  const deliveryEmails = [
    'delivery1@projectname.com',
    'delivery2@projectname.com',
    'delivery3@projectname.com',
    'delivery4@projectname.com',
    'delivery5@projectname.com',
    'delivery6@projectname.com',
    'delivery7@projectname.com',
  ];

  const customerIds = (
    await Promise.all(customerEmails.map((email) => prisma.user.findUnique({ where: { email } })))
  ).map((row) => row?.id ?? '');
  const vendorUserIds = (
    await Promise.all(vendorEmails.map((email) => prisma.user.findUnique({ where: { email } })))
  ).map((row) => row?.id ?? '');
  const deliveryUserIds = (
    await Promise.all(deliveryEmails.map((email) => prisma.user.findUnique({ where: { email } })))
  ).map((row) => row?.id ?? '');

  const subAdmin = await prisma.user.findUnique({ where: { email: 'subadmin@projectname.com' } });
  const vendorIds = await seedVendors(prisma, vendorUserIds);
  const deliveryBoyIds = await seedDeliveryBoys(prisma, deliveryUserIds);
  const addressIds = await seedAddresses(prisma, customerIds);
  await seedAuthArtefacts(prisma, customerIds, vendorUserIds);

  // eslint-disable-next-line no-console
  console.log('[seed]   identity (users, vendors, delivery boys, addresses, auth) — done');

  return {
    superAdminId,
    subAdminId: subAdmin?.id ?? '',
    customerIds,
    vendorUserIds,
    deliveryUserIds,
    vendorIds,
    deliveryBoyIds,
    addressIds,
  };
};
