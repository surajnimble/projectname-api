/**
 * Shape of the id registry passed between demo seed modules.
 *
 * Later modules (orders, reviews, tickets) need rows created by earlier ones,
 * so each stage returns the ids it owns instead of every module querying the
 * database again.
 */

/** Ids produced by the geo and configuration stage. */
export interface GeoContext {
  countryCode: string;
  currencyCode: string;
  taxConfigId: string;
  shippingZoneId: string;
  shippingMethodId: string;
  expressShippingMethodId: string;
  shippingPartnerId: string;
}

/** Ids produced by the identity stage. */
export interface IdentityContext {
  superAdminId: string;
  subAdminId: string;
  customerIds: string[];
  vendorUserIds: string[];
  deliveryUserIds: string[];
  vendorIds: {
    main: string;
    second: string;
    third: string;
  };
  deliveryBoyIds: string[];
  addressIds: string[];
}

/** Ids produced by the catalog stage. */
export interface CatalogContext {
  categoryId: string;
  subCategoryId: string;
  brandId: string;
  tagIds: string[];
  productIds: string[];
  productIdBySlug: Record<string, string>;
  variantIds: string[];
  collectionIds: string[];
}

/** Ids produced by the commerce stage, consumed by engagement and analytics. */
export interface CommerceContext {
  orderIds: string[];
  orderItemIds: string[];
  paymentIds: string[];
  subOrderIds: string[];
  returnRequestIds: string[];
}

/** Full registry handed to every demo module. */
export interface DemoContext extends GeoContext, IdentityContext, CatalogContext, CommerceContext {
  now: Date;
}
