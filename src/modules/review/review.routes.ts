import { Router } from 'express';
import { z } from 'zod';
import { validate, common } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './review.controller';
import * as schema from './review.schema';

const router = Router();

// ── Reviews ───────────────────────────────────────────────────────────────────

/** GET /reviews/getAll */
router.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listReviewsSchema }),
  controller.getAll,
);

/** GET /reviews/getSummary/:productId */
router.get(
  '/getSummary/:productId',
  authenticate,
  validate({ params: schema.reviewSummaryParamSchema }),
  controller.getSummary,
);

/** GET /reviews/getDistribution/:productId */
router.get(
  '/getDistribution/:productId',
  authenticate,
  validate({ params: schema.reviewDistributionParamSchema }),
  controller.getDistribution,
);

/** POST /reviews/addReview */
router.post(
  '/addReview',
  authenticate,
  validate({ body: schema.addReviewSchema }),
  controller.addReview,
);

/** PATCH /reviews/moderate/:id — admin */
router.patch(
  '/moderate/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.questionIdParamSchema, body: schema.moderateReviewSchema }),
  controller.moderate,
);

/** POST /reviews/reply/:id — the selling shop */
router.post(
  '/reply/:id',
  authenticate,
  ...controller.guards.vendor,
  validate({ params: schema.questionIdParamSchema, body: schema.replyReviewSchema }),
  controller.reply,
);

/** POST /reviews/markHelpful/:id */
router.post(
  '/markHelpful/:id',
  authenticate,
  validate({ params: schema.questionIdParamSchema }),
  controller.markHelpful,
);

/** PATCH /reviews/updateReview/:id */
router.patch(
  '/updateReview/:id',
  authenticate,
  validate({ params: schema.questionIdParamSchema, body: schema.updateReviewSchema }),
  controller.updateReview,
);

/** DELETE /reviews/deleteReview/:id */
router.delete(
  '/deleteReview/:id',
  authenticate,
  validate({ params: schema.questionIdParamSchema }),
  controller.deleteReview,
);

// ── Questions ─────────────────────────────────────────────────────────────────

/** GET /reviews/questions/getAll */
router.get(
  '/questions/getAll',
  authenticate,
  validate({ query: schema.listQuestionsSchema }),
  controller.listQuestions,
);

/** POST /reviews/questions/ask */
router.post(
  '/questions/ask',
  authenticate,
  validate({ body: schema.askQuestionSchema }),
  controller.ask,
);

/** POST /reviews/questions/:id/answer */
router.post(
  '/questions/:id/answer',
  authenticate,
  validate({ params: schema.questionIdParamSchema, body: schema.answerQuestionSchema }),
  controller.answer,
);

/** PATCH /reviews/questions/:id/moderate */
router.patch(
  '/questions/:id/moderate',
  authenticate,
  validate({ params: schema.questionIdParamSchema, body: schema.moderateQuestionSchema }),
  controller.moderateQuestion,
);

/** DELETE /reviews/questions/:id/delete */
router.delete(
  '/questions/:id/delete',
  authenticate,
  validate({ params: schema.questionIdParamSchema }),
  controller.deleteQuestion,
);

export const reviewRoutes = router;

// ── Coupons (admin) ───────────────────────────────────────────────────────────

const coupons = Router();

/** GET /coupons/getAll */
coupons.get(
  '/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listCouponsSchema }),
  controller.couponList,
);

/** POST /coupons/validate — dry run, admin */
coupons.post(
  '/validate',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.validateCouponSchema }),
  controller.couponValidate,
);

/** GET /coupons/getUsages */
coupons.get(
  '/getUsages',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listCouponsSchema }),
  controller.couponUsages,
);

/** POST /coupons/createCoupon */
coupons.post(
  '/createCoupon',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createCouponSchema }),
  controller.couponCreate,
);

/** PATCH /coupons/updateCoupon/:id */
coupons.patch(
  '/updateCoupon/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.couponIdParamSchema, body: schema.updateCouponSchema }),
  controller.couponUpdate,
);

/** PATCH /coupons/toggleStatus/:id */
coupons.patch(
  '/toggleStatus/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.couponIdParamSchema, body: schema.toggleCouponSchema }),
  controller.couponToggle,
);

/** DELETE /coupons/deleteCoupon/:id */
coupons.delete(
  '/deleteCoupon/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.couponIdParamSchema }),
  controller.couponDelete,
);

export const couponRoutes = coupons;

// ── Flash sales ───────────────────────────────────────────────────────────────

const flash = Router();

/** GET /flash-sales/getAll */
flash.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listFlashSalesSchema }),
  controller.flashList,
);

/** GET /flash-sales/getLive */
flash.get('/getLive', authenticate, controller.flashLive);

/** GET /flash-sales/getBySlug/:slug */
flash.get(
  '/getBySlug/:slug',
  authenticate,
  validate({ params: z.object({ slug: common.cuidOrSlug }) }),
  controller.flashBySlug,
);

/** POST /flash-sales/create — admin */
flash.post(
  '/create',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createFlashSaleSchema }),
  controller.flashCreate,
);

/** PATCH /flash-sales/update/:id — admin */
flash.patch(
  '/update/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.flashSaleIdParamSchema, body: schema.updateFlashSaleSchema }),
  controller.flashUpdate,
);

/** DELETE /flash-sales/delete/:id — admin */
flash.delete(
  '/delete/:id',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.flashSaleIdParamSchema }),
  controller.flashDelete,
);

export const flashSaleRoutes = flash;