import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './engagement.controller';
import * as schema from './engagement.schema';

// ── Loyalty ───────────────────────────────────────────────────────────────────

const loyalty = Router();

/** GET /loyalty/getSummary */
loyalty.get('/getSummary', authenticate, controller.getSummary);

/** GET /loyalty/getTiers */
loyalty.get('/getTiers', authenticate, controller.getTiers);

/** GET /loyalty/getHistory */
loyalty.get(
  '/getHistory',
  authenticate,
  validate({ query: schema.listLoyaltySchema }),
  controller.getHistory,
);

/** POST /loyalty/redeem */
loyalty.post('/redeem', authenticate, validate({ body: schema.redeemPointsSchema }), controller.redeemPoints);

/** POST /loyalty/adjust/:userId — admin */
loyalty.post(
  '/adjust/:userId',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.loyaltyUserIdParamSchema, body: schema.adjustPointsSchema }),
  controller.adjust,
);

// ── Referrals ─────────────────────────────────────────────────────────────────

const referrals = Router();

/** GET /referrals/getSummary */
referrals.get('/getSummary', authenticate, controller.getReferralSummary);

/** POST /referrals/apply */
referrals.post('/apply', authenticate, validate({ body: schema.applyReferralSchema }), controller.applyCode);

/** GET /referrals/getAll */
referrals.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listReferralsSchema }),
  controller.getMyReferrals,
);

/** GET /referrals/leaderboard */
referrals.get('/leaderboard', authenticate, controller.getLeaderboard);

/** GET /referrals/admin/getAll — admin */
referrals.get(
  '/admin/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listAdminReferralsSchema }),
  controller.getAllReferrals,
);

/** POST /referrals/:id/complete — admin */
referrals.post(
  '/:id/complete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.referralIdParamSchema }),
  controller.complete,
);

/** PATCH /referrals/:id/updateStatus — admin */
referrals.patch(
  '/:id/updateStatus',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.referralIdParamSchema, body: schema.referralStatusSchema }),
  controller.updateStatus,
);

// ── Gift cards ────────────────────────────────────────────────────────────────

const giftCards = Router();

/** GET /gift-cards/getAll */
giftCards.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listGiftCardsSchema }),
  controller.getMyGiftCards,
);

/** GET /gift-cards/balance */
giftCards.get('/balance', authenticate, controller.getBalance);

/** GET /gift-cards/check */
giftCards.get('/check', authenticate, validate({ query: schema.checkGiftCardSchema }), controller.check);

/** POST /gift-cards/redeem */
giftCards.post('/redeem', authenticate, validate({ body: schema.redeemGiftCardSchema }), controller.redeemGiftCard);

/** GET /gift-cards/admin/getAll — admin */
giftCards.get(
  '/admin/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listAllGiftCardsSchema }),
  controller.getAllGiftCards,
);

/** POST /gift-cards/create — admin */
giftCards.post(
  '/create',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createGiftCardSchema }),
  controller.createGiftCard,
);

/** PATCH /gift-cards/:id/disable — admin */
giftCards.patch(
  '/:id/disable',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.giftCardIdParamSchema }),
  controller.disableGiftCard,
);

/** DELETE /gift-cards/:id/delete — admin */
giftCards.delete(
  '/:id/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.giftCardIdParamSchema }),
  controller.removeGiftCard,
);

// ── Message templates ────────────────────────────────────────────────────────

const templates = Router();

/** GET /templates/email/getAll — admin */
templates.get(
  '/email/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listTemplatesSchema }),
  controller.listEmail,
);

/** POST /templates/email/upsert — admin */
templates.post(
  '/email/upsert',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createEmailTemplateSchema }),
  controller.upsertEmail,
);

/** POST /templates/email/:key/render — admin */
templates.post(
  '/email/:key/render',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.templateKeyParamSchema, body: schema.renderTemplateValuesSchema }),
  controller.renderEmail,
);

/** DELETE /templates/email/:key/delete — admin */
templates.delete(
  '/email/:key/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.templateKeyParamSchema }),
  controller.deleteEmail,
);

/** GET /templates/sms/getAll — admin */
templates.get(
  '/sms/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listTemplatesSchema }),
  controller.listSms,
);

/** POST /templates/sms/upsert — admin */
templates.post(
  '/sms/upsert',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createSmsTemplateSchema }),
  controller.upsertSms,
);

/** POST /templates/sms/:key/render — admin */
templates.post(
  '/sms/:key/render',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.templateKeyParamSchema, body: schema.renderTemplateValuesSchema }),
  controller.renderSms,
);

/** DELETE /templates/sms/:key/delete — admin */
templates.delete(
  '/sms/:key/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.templateKeyParamSchema }),
  controller.deleteSms,
);

/** GET /templates/notification/getAll — admin */
templates.get(
  '/notification/getAll',
  authenticate,
  ...controller.guards.admin,
  validate({ query: schema.listTemplatesSchema }),
  controller.listNotifications,
);

/** POST /templates/notification/upsert — admin */
templates.post(
  '/notification/upsert',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.createNotificationTemplateSchema }),
  controller.upsertNotification,
);

/** POST /templates/notification/:key/render — admin */
templates.post(
  '/notification/:key/render',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.templateKeyParamSchema, body: schema.renderTemplateValuesSchema }),
  controller.renderNotification,
);

/** DELETE /templates/notification/:key/delete — admin */
templates.delete(
  '/notification/:key/delete',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.templateKeyParamSchema }),
  controller.deleteNotification,
);

export const loyaltyRoutes = loyalty;
export const referralRoutes = referrals;
export const giftCardRoutes = giftCards;
export const templateRoutes = templates;