import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './order.controller';
import * as schema from './order.schema';

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * GET /orders/track/:orderNumber — public tracking, no auth.
 * Declared before the authenticated routes so `track` is never shadowed.
 */
router.get(
  '/track/:orderNumber',
  validate({ params: schema.trackParamSchema }),
  controller.track,
);

// ─── Customer ─────────────────────────────────────────────────────────────────

/** GET /orders/getAll */
router.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listOrdersSchema }),
  controller.getAll,
);

/** POST /orders/placeOrder */
router.post(
  '/placeOrder',
  authenticate,
  validate({ body: schema.placeOrderSchema }),
  controller.placeOrder,
);

/** POST /orders/reorder */
router.post(
  '/reorder',
  authenticate,
  validate({ body: schema.reorderSchema }),
  controller.reorder,
);

/** POST /orders/cancelOrder/:id */
router.post(
  '/cancelOrder/:id',
  authenticate,
  validate({ params: schema.orderIdParamSchema, body: schema.cancelOrderSchema }),
  controller.cancelOrder,
);

/** GET /orders/getByNumber/:orderNumber */
router.get(
  '/getByNumber/:orderNumber',
  authenticate,
  validate({ params: schema.orderNumberParamSchema }),
  controller.getByNumber,
);

/** GET /orders/getTimeline/:id */
router.get(
  '/getTimeline/:id',
  authenticate,
  validate({ params: schema.orderIdParamSchema }),
  controller.getTimeline,
);

/** GET /orders/getInvoice/:id — PDF by default, JSON with ?format=json */
router.get(
  '/getInvoice/:id',
  authenticate,
  validate({ params: schema.orderIdParamSchema, query: schema.invoiceQuerySchema }),
  controller.getInvoice,
);

/** GET /orders/getById/:id */
router.get(
  '/getById/:id',
  authenticate,
  validate({ params: schema.orderIdParamSchema }),
  controller.getById,
);

// ─── Vendor ───────────────────────────────────────────────────────────────────

/** GET /orders/vendorOrders */
router.get(
  '/vendorOrders',
  authenticate,
  ...controller.guards.vendor,
  validate({ query: schema.vendorOrdersSchema }),
  controller.vendorOrders,
);

/** PATCH /orders/updateSubOrderStatus/:id */
router.patch(
  '/updateSubOrderStatus/:id',
  authenticate,
  ...controller.guards.vendor,
  validate({ params: schema.orderIdParamSchema, body: schema.updateSubOrderStatusSchema }),
  controller.updateSubOrderStatus,
);

/** POST /orders/vendorCancelSubOrder/:id */
router.post(
  '/vendorCancelSubOrder/:id',
  authenticate,
  ...controller.guards.vendor,
  validate({ params: schema.orderIdParamSchema, body: schema.cancelSubOrderSchema }),
  controller.vendorCancelSubOrder,
);

// ─── Admin ────────────────────────────────────────────────────────────────────

/** PATCH /orders/updateStatus/:id */
router.patch(
  '/updateStatus/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.orderIdParamSchema, body: schema.updateOrderStatusSchema }),
  controller.updateStatus,
);

/** POST /orders/assignDeliveryBoy/:id — targets a sub-order id */
router.post(
  '/assignDeliveryBoy/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.orderIdParamSchema, body: schema.assignDeliveryBoySchema }),
  controller.assignDeliveryBoy,
);

/** POST /orders/confirmDelivery/:id — targets a sub-order id */
router.post(
  '/confirmDelivery/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.orderIdParamSchema, body: schema.confirmDeliverySchema }),
  controller.confirmDelivery,
);

/** GET /orders/adminGetById/:id — any order, ignoring ownership */
router.get(
  '/adminGetById/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.orderIdParamSchema }),
  controller.adminGetById,
);

export default router;