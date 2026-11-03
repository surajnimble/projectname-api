/**
 * Seeds the catalog: categories, brands, products, images, variants and the
 * collections and tags the storefront lists.
 *
 * The base seed leaves its four products unapproved, which hides them from the
 * public listing. Here they are approved and given media so every product route
 * returns a complete row on a local database.
 */
import { PrismaClient } from '@prisma/client';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { CatalogContext, IdentityContext } from './types';

interface ProductSeed {
  slug: string;
  vendorId: string;
  categorySlug: string | null;
  brandSlug: string | null;
  name: string;
  description: string;
  sku: string;
  price: number;
  mrpPrice: number;
  stock: number;
  isFeatured: boolean;
}

/** Ensures every product the demo references exists and is publicly visible. */
const seedProducts = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  categoryBySlug: Record<string, string>,
  brandBySlug: Record<string, string>,
): Promise<Record<string, string>> => {
  const products: ProductSeed[] = [
    {
      slug: 'classic-cotton-shirt',
      vendorId: identity.vendorIds.main,
      categorySlug: 'shirts',
      brandSlug: null,
      name: 'Classic Cotton Shirt',
      description: 'Breathable cotton shirt for everyday wear.',
      sku: 'SHIRT-CLS-001',
      price: 799,
      mrpPrice: 1299,
      stock: 50,
      isFeatured: true,
    },
    {
      slug: 'slim-fit-trousers',
      vendorId: identity.vendorIds.main,
      categorySlug: 'trousers',
      brandSlug: null,
      name: 'Slim Fit Trousers',
      description: 'Tailored slim fit trousers.',
      sku: 'TROUSER-SLM-002',
      price: 1199,
      mrpPrice: 1899,
      stock: 35,
      isFeatured: false,
    },
    {
      slug: 'wireless-headphones',
      vendorId: identity.vendorIds.main,
      categorySlug: 'electronics',
      brandSlug: 'technova',
      name: 'Wireless Headphones',
      description: 'Over-ear wireless headphones with 30h battery.',
      sku: 'ELEC-WH-100',
      price: 2499,
      mrpPrice: 3999,
      stock: 20,
      isFeatured: true,
    },
    {
      slug: 'cotton-t-shirt',
      vendorId: identity.vendorIds.main,
      categorySlug: 't-shirts',
      brandSlug: null,
      name: 'Cotton T-Shirt',
      description: 'Soft combed cotton t-shirt.',
      sku: 'TSHIRT-CTN-003',
      price: 499,
      mrpPrice: 899,
      stock: 80,
      isFeatured: false,
    },
    {
      slug: 'smart-watch-pro',
      vendorId: identity.vendorIds.second,
      categorySlug: 'electronics',
      brandSlug: 'technova',
      name: 'Smart Watch Pro',
      description: 'AMOLED smart watch with SpO2 and 7-day battery.',
      sku: 'WATCH-PRO-001',
      price: 3499,
      mrpPrice: 4999,
      stock: 25,
      isFeatured: true,
    },
    {
      slug: 'bluetooth-speaker-mini',
      vendorId: identity.vendorIds.second,
      categorySlug: 'electronics',
      brandSlug: 'soundwave',
      name: 'Bluetooth Speaker Mini',
      description: 'Pocket speaker with 12h playtime and IPX5 rating.',
      sku: 'SPEAKER-MINI-002',
      price: 1499,
      mrpPrice: 2299,
      stock: 40,
      isFeatured: false,
    },
    {
      slug: 'fitness-band-lite',
      vendorId: identity.vendorIds.second,
      categorySlug: 'electronics',
      brandSlug: 'soundwave',
      name: 'Fitness Band Lite',
      description: 'Lightweight band with sleep and heart-rate tracking.',
      sku: 'BAND-LITE-003',
      price: 1999,
      mrpPrice: 2999,
      stock: 60,
      isFeatured: false,
    },
  ];

  const idBySlug: Record<string, string> = {};

  for (const [index, product] of products.entries()) {
    const row = await seedRowBy(
      prisma,
      'product',
      { slug: product.slug },
      demoId('product', index + 1),
      {
        vendorId: product.vendorId,
        categoryId: product.categorySlug ? (categoryBySlug[product.categorySlug] ?? null) : null,
        brandId: product.brandSlug ? (brandBySlug[product.brandSlug] ?? null) : null,
        name: product.name,
        slug: product.slug,
        description: product.description,
        sku: product.sku,
        price: product.price,
        mrpPrice: product.mrpPrice,
        costPrice: Math.round(product.price * 0.6),
        taxPercent: 18,
        stock: product.stock,
        lowStockThreshold: 5,
        weight: 0.5,
        warrantyMonths: 6,
        warrantySummary: '6 month manufacturer warranty',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        approvedBy: identity.superAdminId,
        submittedAt: daysFromNow(-30),
        isFeatured: product.isFeatured,
        soldCount: 10 + index * 3,
        viewCount: 120 + index * 15,
        rating: 4 + (index % 5) / 10,
        ratingCount: 8 + index,
      },
    );
    idBySlug[product.slug] = row.id;
  }

  // The base seed creates these four as PENDING, which filters them out of the
  // public listing; approving them makes the storefront non-empty locally.
  await prisma.product.updateMany({
    where: { slug: { in: products.slice(0, 4).map((product) => product.slug) } },
    data: {
      approvalStatus: 'APPROVED',
      status: 'ACTIVE',
      submittedAt: daysFromNow(-30),
      approvedBy: identity.superAdminId,
    },
  });

  return idBySlug;
};

/** Adds the brands, tags and attributes the new products reference. */
const seedCatalogReference = async (
  prisma: PrismaClient,
): Promise<{ brandBySlug: Record<string, string>; tagIds: string[]; attributeIds: string[] }> => {
  await seedRowBy(prisma, 'brand', { slug: 'soundwave' }, demoId('brand', 'soundwave'), {
    name: 'SoundWave',
    slug: 'soundwave',
    description: 'Audio and wearable accessories.',
    isActive: true,
  });

  for (const tag of [
    { name: 'bestseller', slug: 'bestseller' },
    { name: 'trending', slug: 'trending' },
  ]) {
    await seedRowBy(prisma, 'tag', { slug: tag.slug }, demoId('tag', tag.slug), {
      ...tag,
      isActive: true,
    });
  }

  await seedRowBy(prisma, 'attribute', { slug: 'warranty' }, demoId('attribute', 'warranty'), {
    name: 'Warranty',
    slug: 'warranty',
    type: 'SELECT',
    options: ['6 months', '1 year', '2 years'],
    isVariant: false,
    isFilterable: true,
    isActive: true,
  });

  const brands = await prisma.brand.findMany({ select: { id: true, slug: true } });
  const brandBySlug = Object.fromEntries(brands.map((brand) => [brand.slug, brand.id]));

  const tags = await prisma.tag.findMany({ select: { id: true, slug: true } });
  const tagIds = tags.map((tag) => tag.id);

  const attributes = await prisma.attribute.findMany({ select: { id: true, slug: true } });
  const attributeBySlug = Object.fromEntries(
    attributes.map((attribute) => [attribute.slug, attribute.id]),
  );

  return {
    brandBySlug,
    tagIds,
    attributeIds: [attributeBySlug.size, attributeBySlug.colour, attributeBySlug.warranty].filter(
      Boolean,
    ),
  };
};

/** Gives every demo product media, variants and attribute values. */
const seedProductDetails = async (
  prisma: PrismaClient,
  productIdBySlug: Record<string, string>,
  attributeIds: string[],
  tagIds: string[],
): Promise<string[]> => {
  const slugs = Object.keys(productIdBySlug);

  for (const [index, slug] of slugs.entries()) {
    const productId = productIdBySlug[slug];
    if (!productId) continue;

    for (const [imageIndex, suffix] of ['front', 'side'].entries()) {
      await seedRow(prisma, 'productImage', demoId(`image-${slug}`, suffix), {
        productId,
        url: `https://picsum.photos/seed/${slug}-${suffix}/600/600`,
        publicId: `demo/${slug}-${suffix}`,
        altText: `${slug} ${suffix}`,
        sortOrder: imageIndex,
      });
    }

    await seedRow(prisma, 'productVariant', demoId(`variant-${slug}`, 'a'), {
      productId,
      sku: `${slug.toUpperCase()}-V1`,
      title: index % 2 === 0 ? 'Default' : 'Standard',
      attributes: index % 2 === 0 ? { size: 'M' } : { colour: 'Black' },
      price: 0,
      mrpPrice: 0,
      stock: 10 + index,
      isActive: true,
      sortOrder: 0,
    });
  }

  const canRetrieve = Boolean(productIdBySlug['classic-cotton-shirt']);
  if (canRetrieve) {
    const shirtId = productIdBySlug['classic-cotton-shirt'];
    for (const [index, colour] of ['Black', 'White'].entries()) {
      await seedRow(prisma, 'productVariant', demoId('variant-shirt', colour), {
        productId: shirtId,
        sku: `SHIRT-CLS-${colour.toUpperCase()}`,
        title: colour,
        attributes: { colour },
        price: 799,
        mrpPrice: 1299,
        stock: 15,
        isActive: true,
        sortOrder: index + 1,
      });
    }
  }

  for (const [index, slug] of slugs.slice(0, 4).entries()) {
    const productId = productIdBySlug[slug];
    if (!productId || !tagIds[index % tagIds.length]) continue;
    await prisma.productTag.upsert({
      where: { productId_tagId: { productId, tagId: tagIds[index % tagIds.length] } },
      create: { productId, tagId: tagIds[index % tagIds.length] },
      update: {},
    });
  }

  for (const [index, slug] of slugs.slice(0, 4).entries()) {
    const productId = productIdBySlug[slug];
    const attributeId = attributeIds[index % attributeIds.length];
    if (!productId || !attributeId) continue;
    await prisma.productAttributeValue.upsert({
      where: { productId_attributeId: { productId, attributeId } },
      create: { productId, attributeId, value: index % 2 === 0 ? 'Cotton' : 'Black' },
      update: {},
    });
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: slugs.map((slug) => productIdBySlug[slug]).filter(Boolean) } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return variants.map((variant) => variant.id);
};

/** Adds collections, the products inside them and recent views. */
const seedCollections = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  productIdBySlug: Record<string, string>,
): Promise<string[]> => {
  for (const collection of [
    {
      name: 'New Arrivals',
      slug: 'new-arrivals',
      description: 'The latest products across every shop.',
      sortOrder: 1,
    },
    {
      name: 'Best Sellers',
      slug: 'best-sellers',
      description: 'What customers buy most.',
      sortOrder: 2,
    },
  ]) {
    await seedRowBy(
      prisma,
      'collection',
      { slug: collection.slug },
      demoId('collection', collection.slug),
      { ...collection, type: 'MANUAL', isActive: true },
    );
  }

  const collections = await prisma.collection.findMany({ select: { id: true, slug: true } });
  const collectionIds = collections.map((collection) => collection.id);

  const slugs = Object.keys(productIdBySlug);
  for (const [index, slug] of slugs.slice(0, 4).entries()) {
    const productId = productIdBySlug[slug];
    const collectionId = collectionIds[index % collectionIds.length];
    if (!productId || !collectionId) continue;
    await prisma.collectionProduct.upsert({
      where: { collectionId_productId: { collectionId, productId } },
      create: { collectionId, productId, sortOrder: index },
      update: {},
    });
  }

  for (const [index, customerId] of identity.customerIds.entries()) {
    const productId = productIdBySlug[slugs[index % slugs.length]];
    if (!productId) continue;
    await seedRow(prisma, 'recentlyViewed', demoId('recently-viewed', index + 1), {
      userId: customerId,
      sessionKey: `demo-session-${index + 1}`,
      productId,
      viewedAt: daysFromNow(-index),
    });
  }

  return collectionIds;
};

/** Seeds the whole catalog and returns the ids later stages reference. */
export const seedCatalog = async (
  prisma: PrismaClient,
  identity: IdentityContext,
): Promise<CatalogContext> => {
  const reference = await seedCatalogReference(prisma);

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryBySlug = Object.fromEntries(
    categories.map((category) => [category.slug, category.id]),
  );

  const productIdBySlug = await seedProducts(
    prisma,
    identity,
    categoryBySlug,
    reference.brandBySlug,
  );

  const variantIds = await seedProductDetails(
    prisma,
    productIdBySlug,
    reference.attributeIds,
    reference.tagIds,
  );
  const collectionIds = await seedCollections(prisma, identity, productIdBySlug);

  const productIds = Object.values(productIdBySlug);

  // eslint-disable-next-line no-console
  console.log('[seed]   catalog (categories, brands, products, variants, collections) — done');

  return {
    categoryId: categoryBySlug.electronics ?? '',
    subCategoryId: categoryBySlug.shirts ?? '',
    brandId: reference.brandBySlug.technova ?? '',
    tagIds: reference.tagIds,
    productIds,
    productIdBySlug,
    variantIds,
    collectionIds,
  };
};
