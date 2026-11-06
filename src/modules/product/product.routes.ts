import { Router } from 'express';
import { validate, paginationSchema } from '../../middlewares/validate.middleware';
import { authenticate, optionalAuth } from '../../middlewares/auth.middleware';
import { uploadRateLimit } from '../../middlewares/rateLimit.middleware';
import { uploadFiles, uploadSingle } from '../../middlewares/upload.middleware';
import { UPLOAD_KIND } from '../../config/upload.config';
import * as controller from './product.controller';
import * as schema from './product.schema';

const router = Router();

/**
 * @openapi
 * /products/getAll:
 *   get:
 *     tags: [Products]
 *     summary: List products
 *     description: >
 *       Public callers only see ACTIVE products from APPROVED shops.
 *       A logged-in VENDOR automatically sees their own drafts instead.
 *       Filters: `?search=`, `?categoryId=`, `?categorySlug=`, `?brandId=`,
 *       `?vendorId=`, `?tagIds=a,b`, `?minPrice=`, `?maxPrice=`, `?inStock=1`,
 *       `?isFeatured=1`, `?status=ACTIVE`, `?sort=-price`.
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { name: sort, in: query, schema: { type: string, example: -createdAt } }
 *     responses:
 *       200: { description: Paginated product list, pagination fields first }
 */
router.get(
  '/getAll',
  optionalAuth,
  validate({ query: schema.listProductsSchema }),
  controller.getAll,
);

/**
 * @openapi
 * /products/getById/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Single product by id, with variants, images and recent reviews
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 */
router.get(
  '/getById/:id',
  optionalAuth,
  validate({ params: schema.productIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /products/getBySlug/{slug}:
 *   get:
 *     tags: [Products]
 *     summary: Single product by slug (SEO URL); increments the view counter
 *     parameters:
 *       - { name: slug, in: path, required: true, schema: { type: string } }
 */
router.get(
  '/getBySlug/:slug',
  optionalAuth,
  validate({ params: schema.productSlugParamSchema }),
  controller.getBySlug,
);

router.get(
  '/getFilters',
  optionalAuth,
  validate({ query: schema.getFiltersSchema }),
  controller.getFilters,
);

router.get(
  '/getRelated/:id',
  optionalAuth,
  validate({ params: schema.relatedParamsSchema, query: paginationSchema }),
  controller.getRelated,
);

router.get(
  '/getRecommended',
  authenticate,
  validate({ query: paginationSchema }),
  controller.getRecommended,
);

router.get(
  '/getFrequentlyBought/:id',
  optionalAuth,
  validate({ params: schema.relatedParamsSchema, query: paginationSchema }),
  controller.getFrequentlyBought,
);

router.get(
  '/getRecentlyViewed',
  authenticate,
  validate({ query: paginationSchema }),
  controller.getRecentlyViewed,
);

router.post(
  '/trackView/:id',
  optionalAuth,
  validate({ params: schema.relatedParamsSchema }),
  controller.trackView,
);

/**
 * @openapi
 * /products/createProduct:
 *   post:
 *     tags: [Products]
 *     summary: Create a product (vendor)
 *     description: >
 *       Requires an APPROVED vendor profile, else 403 VENDOR_NOT_APPROVED.
 *       `slug` is generated from `name` and auto-suffixed (`-2`, `-3`) on collision.
 *       Status defaults to ACTIVE when stock > 0, otherwise DRAFT.
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/createProduct',
  authenticate,
  ...controller.guards.vendor,
  validate({ body: schema.createProductSchema }),
  controller.createProduct,
);

router.patch(
  '/updateProduct/:id',
  authenticate,
  validate({ params: schema.productIdParamSchema, body: schema.updateProductSchema }),
  controller.updateProduct,
);

/**
 * @openapi
 * /products/deleteProduct/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Soft-delete a product
 *     description: >
 *       Sets `deletedAt` and status ARCHIVED so existing order lines keep resolving.
 *       Row is recoverable; nothing is physically removed.
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  '/deleteProduct/:id',
  authenticate,
  validate({ params: schema.productIdParamSchema }),
  controller.deleteProduct,
);

router.patch(
  '/updateStock/:id',
  authenticate,
  ...controller.guards.stockUpdate,
  validate({ params: schema.productIdParamSchema, body: schema.updateStockSchema }),
  controller.updateStock,
);

/**
 * @openapi
 * /products/adjustStock/{id}:
 *   post:
 *     tags: [Products]
 *     summary: Apply an audited stock adjustment to a product or variant
 *     description: Add/remove stock atomically, or set an absolute quantity using an expected-stock check. Negative stock is rejected.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [adjustment, reason]
 *             properties:
 *               adjustment: { type: integer, minimum: -1000000, maximum: 1000000 }
 *               setStockTo: { type: integer, minimum: 0 }
 *               expectedStock: { type: integer, minimum: -1000000, description: Current quantity to compare; supports correction of legacy negative stock }
 *               lowStockThreshold: { type: integer, minimum: 0 }
 *               variantId: { type: string }
 *               reason: { type: string, minLength: 3, maxLength: 300 }
 *     responses:
 *       200: { description: Stock adjustment applied }
 *       403: { description: Missing product:update permission }
 *       422: { description: Stock changed or adjustment would make inventory negative }
 */
router.post(
  '/adjustStock/:id',
  authenticate,
  ...controller.guards.adminUpdate,
  validate({ params: schema.productIdParamSchema, body: schema.adjustStockSchema }),
  controller.adjustStock,
);

/**
 * @openapi
 * /products/inventory:
 *   get:
 *     tags: [Products]
 *     summary: List inventory stock items across the full catalogue
 *     description: Server-side search, stock-state filters, pagination and global inventory totals. Variant SKUs are listed independently.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, minimum: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { name: search, in: query, schema: { type: string, maxLength: 120 } }
 *       - { name: status, in: query, schema: { type: string, enum: [ALL, LOW, OUT, HEALTHY] } }
 *     responses:
 *       200: { description: Paginated inventory with global totals }
 *       403: { description: Missing report:view permission }
 */
router.get(
  '/inventory',
  authenticate,
  ...controller.guards.inventoryRead,
  validate({ query: schema.inventoryListQuerySchema }),
  controller.listInventory,
);

/**
 * @openapi
 * /products/stockMovements:
 *   get:
 *     tags: [Products]
 *     summary: Get paginated inventory adjustment history
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, minimum: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { name: productId, in: query, schema: { type: string } }
 *     responses:
 *       200: { description: Stock movement history }
 *       403: { description: Missing report:view permission }
 */
router.get(
  '/stockMovements',
  authenticate,
  ...controller.guards.inventoryRead,
  validate({ query: schema.stockMovementsQuerySchema }),
  controller.getStockMovements,
);

router.patch(
  '/toggleStatus/:id',
  authenticate,
  validate({ params: schema.productIdParamSchema, body: schema.toggleStatusSchema }),
  controller.toggleStatus,
);

/**
 * @openapi
 * /products/submitForApproval/{id}:
 *   post:
 *     tags: [Products]
 *     summary: Submit a product for admin approval (vendor)
 *     description: >
 *       Sets `approvalStatus` to PENDING and records `submittedAt`.
 *       A rejected product can be resubmitted; an approved one cannot.
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/submitForApproval/:id',
  authenticate,
  ...controller.guards.vendor,
  validate({ params: schema.productApprovalParamSchema }),
  controller.submitForApproval,
);

/**
 * @openapi
 * /products/getPendingApprovals:
 *   get:
 *     tags: [Products]
 *     summary: List products awaiting approval (admin)
 *     description: >
 *       Oldest submission first. Filters: `?search=`, `?vendorId=`.
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  '/getPendingApprovals',
  authenticate,
  ...controller.guards.adminCatalog,
  validate({ query: schema.listPendingApprovalsSchema }),
  controller.getPendingApprovals,
);

/**
 * @openapi
 * /products/approveProduct/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Approve a product and make it visible (admin)
 *     description: >
 *       Sets `approvalStatus` to APPROVED. The product becomes ACTIVE only when
 *       it has stock; otherwise it stays DRAFT.
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/approveProduct/:id',
  authenticate,
  ...controller.guards.adminApprove,
  validate({ params: schema.productApprovalParamSchema }),
  controller.approveProduct,
);

/**
 * @openapi
 * /products/rejectProduct/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Reject a product with a reason (admin)
 *     description: >
 *       Sets `approvalStatus` to REJECTED and status to INACTIVE, so the
 *       product leaves the storefront immediately.
 *     security: [{ bearerAuth: [] }]
 */
router.patch(
  '/rejectProduct/:id',
  authenticate,
  ...controller.guards.adminApprove,
  validate({ params: schema.productApprovalParamSchema, body: schema.rejectProductSchema }),
  controller.rejectProduct,
);

/**
 * @openapi
 * /products/uploadImages/{id}:
 *   post:
 *     tags: [Products]
 *     summary: Upload product images (multipart/form-data)
 *     description: >
 *       Field `files`, up to `catalogMaxImagesPerProduct` in total, JPEG/PNG/WebP
 *       up to 5MB each. Exceeding the limit returns 400 IMAGE_LIMIT_EXCEEDED.
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/uploadImages/:id',
  authenticate,
  uploadRateLimit,
  validate({ params: schema.uploadImagesParamsSchema }),
  uploadFiles(UPLOAD_KIND.IMAGE, 'files'),
  controller.uploadImages,
);

router.delete(
  '/deleteImage/:id/:imageId',
  authenticate,
  validate({ params: schema.deleteImageParamsSchema }),
  controller.deleteImage,
);

router.post(
  '/bulkCreate',
  authenticate,
  ...controller.guards.vendor,
  validate({ body: schema.bulkCreateSchema }),
  controller.bulkCreate,
);

router.patch(
  '/bulkUpdate',
  authenticate,
  validate({ body: schema.bulkUpdateSchema }),
  controller.bulkUpdate,
);

router.patch(
  '/bulkDelete',
  authenticate,
  validate({ body: schema.bulkDeleteSchema }),
  controller.bulkDelete,
);

/**
 * @openapi
 * /products/bulkPriceUpdate:
 *   post:
 *     tags: [Products]
 *     summary: Adjust prices across many products
 *     description: >
 *       `type` is FIXED | PERCENT_UP | PERCENT_DOWN. The result is never
 *       rounded below 0.01. Returns per-product previous and new price.
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  '/bulkPriceUpdate',
  authenticate,
  validate({ body: schema.bulkPriceUpdateSchema }),
  controller.bulkPriceUpdate,
);

router.post(
  '/bulkImportCsv',
  authenticate,
  uploadRateLimit,
  ...controller.guards.vendor,
  uploadSingle(UPLOAD_KIND.CSV, 'file'),
  controller.bulkImportCsv,
);

router.get(
  '/exportCsv',
  authenticate,
  validate({ query: schema.listProductsSchema }),
  controller.exportCsv,
);

export default router;
