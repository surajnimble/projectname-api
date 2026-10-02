import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './cart.controller';
import * as schema from './cart.schema';

const router = Router();

// ─── Cart ─────────────────────────────────────────────────────────────────────

/** GET /cart/getCart */
router.get(
  '/getCart',
  authenticate,
  async (req, res, next) => controller.getCart(req, res, next),
);

/** GET /cart/items */
router.get(
  '/items',
  authenticate,
  async (req, res, next) => controller.listItems(req, res, next),
);

/** POST /cart/addItem */
router.post(
  '/addItem',
  authenticate,
  validate({ body: schema.addItemSchema }),
  async (req, res, next) => controller.addItem(req, res, next),
);

/** PATCH /cart/updateItem */
router.patch(
  '/updateItem',
  authenticate,
  validate({ body: schema.updateItemSchema }),
  async (req, res, next) => controller.updateItem(req, res, next),
);

/** POST /cart/removeItem — body id or productId */
router.post(
  '/removeItem',
  authenticate,
  validate({ body: schema.removeItemSchema }),
  async (req, res, next) => controller.removeItem(req, res, next),
);

/** POST /cart/clear */
router.post(
  '/clear',
  authenticate,
  validate({ body: schema.clearCartSchema }),
  async (req, res, next) => controller.clearCart(req, res, next),
);

/** POST /cart/applyCoupon */
router.post(
  '/applyCoupon',
  authenticate,
  validate({ body: schema.applyCouponSchema }),
  async (req, res, next) => controller.applyCoupon(req, res, next),
);

/** POST /cart/removeCoupon */
router.post(
  '/removeCoupon',
  authenticate,
  validate({ body: schema.removeCouponSchema }),
  async (req, res, next) => controller.removeCoupon(req, res, next),
);

/** POST /cart/estimate */
router.post(
  '/estimate',
  authenticate,
  validate({ body: schema.estimateSchema }),
  async (req, res, next) => controller.estimate(req, res, next),
);

/** POST /cart/mergeGuestCart */
router.post(
  '/mergeGuestCart',
  authenticate,
  validate({ body: schema.mergeGuestCartSchema }),
  async (req, res, next) => controller.mergeGuestCart(req, res, next),
);

export const cartRoutes = router;

// ─── Wishlist ─────────────────────────────────────────────────────────────────

const wishlist = Router();

/** GET /wishlist/getAll */
wishlist.get(
  '/getAll',
  authenticate,
  async (req, res, next) => controller.getWishlist(req, res, next),
);

/** GET /wishlist/checkProduct/:productId */
wishlist.get(
  '/checkProduct/:productId',
  authenticate,
  async (req, res, next) => controller.checkProduct(req, res, next),
);

/** POST /wishlist/addItem */
wishlist.post(
  '/addItem',
  authenticate,
  validate({ body: schema.addWishlistItemSchema }),
  async (req, res, next) => controller.addWishlistItem(req, res, next),
);

/** POST /wishlist/moveToCart/:id */
wishlist.post(
  '/moveToCart/:id',
  authenticate,
  validate({ body: schema.moveToCartSchema }),
  async (req, res, next) => controller.moveToCart(req, res, next),
);

/** DELETE /wishlist/removeItem/:id */
wishlist.delete(
  '/removeItem/:id',
  authenticate,
  async (req, res, next) => controller.removeWishlistItem(req, res, next),
);

/** POST /wishlist/clear */
wishlist.post(
  '/clear',
  authenticate,
  async (req, res, next) => controller.clearWishlist(req, res, next),
);

export const wishlistRoutes = wishlist;