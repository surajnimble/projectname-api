import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './payment.controller';
import * as schema from './payment.schema';

const router = Router();

// ── Payments ──────────────────────────────────────────────────────────────────

/** GET /payments/getAll — the caller's own payments. */
router.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listPaymentsSchema }),
  controller.getAll,
);

/** GET /payments/getMethods — public-ish config, still behind auth. */
router.get('/getMethods', authenticate, controller.getMethods);

/** GET /payments/getByOrder/:orderId */
router.get(
  '/getByOrder/:orderId',
  authenticate,
  validate({ params: schema.paymentOrderParamSchema }),
  controller.getByOrder,
);

/** POST /payments/verifyTokenPayment */
router.post(
  '/verifyTokenPayment',
  authenticate,
  validate({ body: schema.verifyTokenPaymentSchema }),
  controller.verifyTokenPayment,
);

/** POST /payments/payBalance */
router.post(
  '/payBalance',
  authenticate,
  validate({ body: schema.payBalanceSchema }),
  controller.payBalance,
);

/** POST /payments/initiateRefund */
router.post(
  '/initiateRefund',
  authenticate,
  validate({ body: schema.initiateRefundSchema }),
  controller.initiateRefund,
);

/** GET /payments/getRefunds — admin only. */
router.get(
  '/getRefunds',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listPaymentsSchema }),
  controller.getRefunds,
);

/** PATCH /payments/processRefund/:id — admin settles a pending refund. */
router.patch(
  '/processRefund/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.refundParamSchema, body: schema.processRefundSchema }),
  controller.processRefund,
);

/** POST /payments/codCollect — admin records cash taken. */
router.post(
  '/codCollect',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.codCollectSchema }),
  controller.codCollect,
);

// ── Wallet ────────────────────────────────────────────────────────────────────

/** GET /payments/wallet/balance */
router.get('/wallet/balance', authenticate, controller.walletBalance);

/** GET /payments/wallet/transactions */
router.get(
  '/wallet/transactions',
  authenticate,
  validate({ query: schema.walletListSchema }),
  controller.walletTransactions,
);

/** POST /payments/wallet/adjust — admin credit or debit. */
router.post(
  '/wallet/adjust',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.walletAmountSchema }),
  controller.walletAdjust,
);

// ── Payout ────────────────────────────────────────────────────────────────────

/** GET /payments/payouts/getAll */
router.get(
  '/payouts/getAll',
  authenticate,
  validate({ query: schema.listPayoutsSchema }),
  controller.payoutList,
);

/** GET /payments/payouts/earnings */
router.get(
  '/payouts/earnings',
  authenticate,
  validate({ query: schema.earningsSchema }),
  controller.earnings,
);

/** POST /payments/payouts/request — vendor only. */
router.post(
  '/payouts/request',
  authenticate,
  ...controller.guards.vendor,
  validate({ body: schema.requestPayoutSchema }),
  controller.requestPayout,
);

/** PATCH /payments/payouts/updateStatus/:id — admin only. */
router.patch(
  '/payouts/updateStatus/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.payoutIdParamSchema, body: schema.payoutStatusSchema }),
  controller.updatePayoutStatus,
);

// ── Returns ───────────────────────────────────────────────────────────────────

/** GET /payments/returns/reasons — declared before /:id so it is not shadowed. */
router.get('/returns/reasons', authenticate, controller.returnReasons);

/** POST /payments/returns/addReason — admin only. */
router.post(
  '/returns/addReason',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.returnReasonSchema }),
  controller.addReturnReason,
);

/** PATCH /payments/returns/updateReason/:id — admin only. */
router.patch(
  '/returns/updateReason/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.returnIdParamSchema, body: schema.returnReasonUpdateSchema }),
  controller.updateReturnReason,
);

/** POST /payments/returns/request */
router.post(
  '/returns/request',
  authenticate,
  validate({ body: schema.requestReturnSchema }),
  controller.requestReturn,
);

/** GET /payments/returns/getAll */
router.get(
  '/returns/getAll',
  authenticate,
  validate({ query: schema.listReturnsSchema }),
  controller.returnList,
);

/** PATCH /payments/returns/processRefund/:id — admin only. */
router.patch(
  '/returns/processRefund/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.returnIdParamSchema, body: schema.processReturnRefundSchema }),
  controller.processReturnRefund,
);

/** PATCH /payments/returns/updateStatus/:id */
router.patch(
  '/returns/updateStatus/:id',
  authenticate,
  validate({ params: schema.returnIdParamSchema, body: schema.returnStatusSchema }),
  controller.updateReturnStatus,
);

/** GET /payments/returns/getById/:id */
router.get(
  '/returns/getById/:id',
  authenticate,
  validate({ params: schema.returnIdParamSchema }),
  controller.returnById,
);

export default router;