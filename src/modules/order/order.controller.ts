import { Request } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { SUCCESS } from '../../messages/success';
import { asyncHandler } from '../../utils/asyncHandler';
import { D } from '../../utils/defaults';
import { getPagination } from '../../utils/pagination';
import { requireRole } from '../../middlewares/auth.middleware';
import * as service from './order.service';
import {
  serializeOrder,
  serializeOrderSummary,
  serializeVendorOrder,
  serializePlaceOrderResult,
  serializeTrackOrder,
  serializeOrderTimeline,
  serializeSubOrder,
} from './order.serializer';

const userId = (req: Request): string => req.auth!.userId;
const vendorId = (req: Request): string => req.auth!.vendorId;

export const guards = {
  admin: [requireRole('SUPER_ADMIN', 'SUB_ADMIN')],
  vendor: [requireRole('VENDOR')],
};

// ─── Customer ─────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders/getAll:
 *   get:
 *     tags: [Orders]
 *     summary: List the caller's orders
 *     description: >
 *       Filters: `?status=`, `?paymentStatus=`, `?paymentMethod=`, `?vendorId=`,
 *       `?from=`, `?to=`, `?search=`, `?sort=-createdAt`.
 *     responses:
 *       200: { description: Paginated order summaries, pagination fields first }
 */
export const getAll = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);

  const { rows, total } = await service.listOrders(userId(req), {
    ...(req.query as any),
    skip,
    take,
  });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ORDER.FETCHED,
    result: { itemList: rows.map(serializeOrderSummary) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/**
 * @openapi
 * /orders/placeOrder:
 *   post:
 *     tags: [Orders]
 *     summary: Place an order from the cart
 *     description: >
 *       Fans out into one sub-order per vendor, decrements stock in a single
 *       transaction, and empties the cart. Pass `skipUnavailable: true` to drop
 *       lines that ran out of stock instead of failing the whole checkout.
 *     responses:
 *       201: { description: Order placed }
 *       422: { description: Empty cart, below minimum, or stock changed }
 */
export const placeOrder = asyncHandler(async (req, res) => {
  const { order, skipped } = await service.placeOrder(userId(req), req.body, req);

  return ApiResponse.created(
    res,
    order.tokenRequired ? SUCCESS.ORDER.TOKEN_PLACED : SUCCESS.ORDER.PLACED,
    serializePlaceOrderResult(order, skipped),
  );
});

/**
 * @openapi
 * /orders/getById/:id:
 *   get:
 *     tags: [Orders]
 *     summary: A single order with sub-orders, items, payments and timeline
 *     responses:
 *       200: { description: Order detail }
 *       404: { description: Not found or not the caller's order }
 */
export const getById = asyncHandler(async (req, res) => {
  const order = await service.getOrderById(D.str(req.params.id), userId(req));
  return ApiResponse.success(res, { message: SUCCESS.ORDER.FETCHED, result: serializeOrder(order) });
});

/**
 * @openapi
 * /orders/getByNumber/:orderNumber:
 *   get:
 *     tags: [Orders]
 *     summary: A single order looked up by its human-readable number
 *     responses:
 *       200: { description: Order detail }
 */
export const getByNumber = asyncHandler(async (req, res) => {
  const order = await service.getOrderByNumber(D.str(req.params.orderNumber), userId(req));
  return ApiResponse.success(res, { message: SUCCESS.ORDER.FETCHED, result: serializeOrder(order) });
});

/**
 * @openapi
 * /orders/getTimeline/:id:
 *   get:
 *     tags: [Orders]
 *     summary: Status history for an order
 *     responses:
 *       200: { description: Timeline entries, oldest first }
 */
export const getTimeline = asyncHandler(async (req, res) => {
  const order = await service.getOrderById(D.str(req.params.id), userId(req));
  const timeline = await service.getTimeline(order.id);

  return ApiResponse.success(res, {
    message: SUCCESS.ORDER.TIMELINE_FETCHED,
    result: {
      orderId: D.str(order.id),
      orderNumber: D.str(order.orderNumber),
      currentStatus: D.str(order.status),
      itemCount: timeline.length,
      timelineList: timeline.map(serializeOrderTimeline),
    },
  });
});

/**
 * @openapi
 * /orders/track/:orderNumber:
 *   get:
 *     tags: [Orders]
 *     summary: Public order tracking (no auth, no customer identity)
 *     responses:
 *       200: { description: Status, shipments and timeline }
 *       404: { description: Order not found }
 */
export const track = asyncHandler(async (req, res) => {
  const order = await service.trackOrder(D.str(req.params.orderNumber));
  return ApiResponse.success(res, { message: SUCCESS.ORDER.TRACKED, result: serializeTrackOrder(order) });
});

/**
 * @openapi
 * /orders/cancelOrder/:id:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel an order (or one vendor's portion)
 *     description: >
 *       Only allowed inside the configured cancellation window. Stock is
 *       restored and any wallet payment is refunded.
 *     responses:
 *       200: { description: Order cancelled }
 *       422: { description: Window passed, already cancelled, or delivered }
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await service.cancelOrder(D.str(req.params.id), userId(req), req.body, req);
  return ApiResponse.success(res, { message: SUCCESS.ORDER.CANCELLED, result: serializeOrder(order) });
});

/**
 * @openapi
 * /orders/reorder:
 *   post:
 *     tags: [Orders]
 *     summary: Refill the cart from a past order
 *     responses:
 *       200: { description: How many lines were added and which were skipped }
 */
export const reorder = asyncHandler(async (req, res) => {
  const { added, skipped } = await service.reorder(userId(req), req.body, req);

  const cart = await (await import('../cart/cart.service')).getCart(userId(req));
  const totals = await (await import('../cart/cart.service')).calculateTotals(cart);

  return ApiResponse.success(res, {
    message: skipped.length ? SUCCESS.ORDER.REORDER_PARTIAL : SUCCESS.ORDER.REORDERED,
    result: {
      addedCount: D.num(added),
      skippedCount: D.arr(skipped).length,
      skippedList: D.arr(skipped).map((s: any) => ({
        productId: D.str(s?.productId),
        name: D.str(s?.name),
        reason: D.str(s?.reason),
      })),
      cart: (await import('../cart/cart.serializer')).serializeCartDetail(cart, totals),
    },
  });
});

/**
 * @openapi
 * /orders/getInvoice/:id:
 *   get:
 *     tags: [Orders]
 *     summary: Invoice for an order
 *     description: HTML by default; pass `?format=json` for a structured payload.
 *     responses:
 *       200: { description: Invoice }
 */
export const getInvoice = asyncHandler(async (req, res) => {
  const order = await service.getOrderById(D.str(req.params.id), userId(req));

  if (D.str(req.query.format as string) === 'json') {
    return ApiResponse.success(res, {
      message: SUCCESS.ORDER.INVOICE_GENERATED,
      result: serializeOrder(order),
    });
  }

  const { generateInvoicePdf, pdfFileName } = await import('../../services/pdf.service');

  const pdf = await generateInvoicePdf({
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    customer: order.user,
    address: order.address,
    items: order.items,
    vendor: D.arr(order.subOrders)[0]?.vendor,
    totals: {
      subtotal: order.subtotal,
      discount: order.discount,
      couponDiscount: order.couponDiscount,
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      walletAmount: order.walletAmount,
      total: order.total,
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${pdfFileName('INVOICE', order.orderNumber)}"`);
  return res.send(pdf);
});

// ─── Vendor ───────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders/vendorOrders:
 *   get:
 *     tags: [Orders]
 *     summary: The signed-in vendor's slice of every order
 *     responses:
 *       200: { description: Paginated sub-orders with customer and address }
 */
export const vendorOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query as any);

  const { rows, total } = await service.listVendorOrders(vendorId(req), {
    ...(req.query as any),
    skip,
    take,
  });

  return ApiResponse.paginated(res, {
    message: SUCCESS.ORDER.VENDOR_ORDERS_FETCHED,
    result: { itemList: rows.map(serializeVendorOrder) },
    totalRecord: total,
    currentPage: page,
    limit,
  });
});

/**
 * @openapi
 * /orders/updateSubOrderStatus/:id:
 *   patch:
 *     tags: [Orders]
 *     summary: A vendor moves their own sub-order through the state machine
 *     responses:
 *       200: { description: Sub-order updated }
 *       422: { description: Transition not allowed from the current status }
 */
export const updateSubOrderStatus = asyncHandler(async (req, res) => {
  const sub = await service.updateSubOrderStatus(
    D.str(req.params.id),
    vendorId(req),
    req.body,
    req.auth!.userId,
    req,
  );

  return ApiResponse.success(res, {
    message: SUCCESS.ORDER.VENDOR_STATUS_UPDATED,
    result: serializeSubOrder(sub),
  });
});

/**
 * @openapi
 * /orders/vendorCancelSubOrder/:id:
 *   post:
 *     tags: [Orders]
 *     summary: A vendor cancels only their own portion of an order
 *     responses:
 *       200: { description: Sub-order cancelled, stock restored }
 */
export const vendorCancelSubOrder = asyncHandler(async (req, res) => {
  const sub = await service.cancelOrder(
    D.str((await findOrderIdForSub(D.str(req.params.id)))),
    userId(req),
    { ...req.body, subOrderId: D.str(req.params.id) },
    req,
  );

  const updated = D.arr(sub.subOrders).find((s: any) => D.str(s.id) === D.str(req.params.id));

  return ApiResponse.success(res, {
    message: SUCCESS.ORDER.CANCELLED,
    result: { orderId: D.str(sub.id), subOrder: serializeSubOrder(updated) },
  });
});

/** Resolves a sub-order id to its parent order id. */
const findOrderIdForSub = async (subOrderId: string): Promise<string> => {
  const { prisma } = await import('../../services/prisma.service');
  const sub = await prisma.subOrder.findUnique({ where: { id: subOrderId }, select: { orderId: true } });
  return D.str(sub?.orderId);
};

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders/updateStatus/:id:
 *   patch:
 *     tags: [Orders]
 *     summary: Move an order through the state machine (admin)
 *     description: >
 *       Rejects any transition not in the state machine. Delivering a COD order
 *       settles its payment; cancelling restores stock.
 *     responses:
 *       200: { description: Order updated }
 *       422: { description: Transition not allowed }
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const order = await service.updateOrderStatus(D.str(req.params.id), req.body, req.auth!.userId, req);
  return ApiResponse.success(res, { message: SUCCESS.ORDER.STATUS_UPDATED, result: serializeOrder(order) });
});

/**
 * @openapi
 * /orders/adminGetById/:id:
 *   get:
 *     tags: [Orders]
 *     summary: Any order, ignoring ownership (admin)
 *     responses:
 *       200: { description: Order detail }
 */
export const adminGetById = asyncHandler(async (req, res) => {
  const order = await service.getOrderById(D.str(req.params.id));
  return ApiResponse.success(res, { message: SUCCESS.ORDER.FETCHED, result: serializeOrder(order) });
});

/**
 * @openapi
 * /orders/assignDeliveryBoy/:id:
 *   post:
 *     tags: [Orders]
 *     summary: Assign a delivery boy to a sub-order
 *     responses:
 *       200: { description: Assigned }
 *       404: { description: Sub-order or delivery boy not found }
 */
export const assignDeliveryBoy = asyncHandler(async (req, res) => {
  const sub = await service.assignDeliveryBoy(
    D.str(req.params.id),
    D.str(req.body.deliveryBoyId),
    req.auth!.userId,
    req,
  );

  return ApiResponse.success(res, {
    message: SUCCESS.ORDER.DELIVERY_BOY_ASSIGNED,
    result: serializeSubOrder(sub),
  });
});

/**
 * @openapi
 * /orders/confirmDelivery/:id:
 *   post:
 *     tags: [Orders]
 *     summary: Confirm a sub-order was delivered
 *     description: COD orders settle here; pass `collectedAmount` for the cash taken.
 *     responses:
 *       200: { description: Delivery confirmed }
 *       422: { description: Already delivered or transition not allowed }
 */
export const confirmDelivery = asyncHandler(async (req, res) => {
  const sub = await service.confirmDelivery(D.str(req.params.id), req.body, req.auth!.userId, req);

  return ApiResponse.success(res, {
    message: SUCCESS.ORDER.DELIVERY_VERIFIED,
    result: serializeSubOrder(sub),
  });
});