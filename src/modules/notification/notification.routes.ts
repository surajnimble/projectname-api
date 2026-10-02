import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import * as controller from './notification.controller';
import * as schema from './notification.schema';

const router = Router();

// ── Notifications ─────────────────────────────────────────────────────────────

/** GET /notifications/getAll */
router.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listNotificationsSchema }),
  controller.getAll,
);

/** GET /notifications/getUnreadCount */
router.get('/getUnreadCount', authenticate, controller.getUnreadCount);

/** POST /notifications/markRead — no ids means "all" */
router.post(
  '/markRead',
  authenticate,
  validate({ body: schema.markReadSchema }),
  controller.markNotificationsRead,
);

/** GET /notifications/getPreferences */
router.get('/getPreferences', authenticate, controller.getPreferences);

/** PATCH /notifications/preferences */
router.patch(
  '/preferences',
  authenticate,
  validate({ body: schema.preferencesSchema }),
  controller.setPreferences,
);

/** DELETE /notifications/:id/delete */
router.delete(
  '/:id/delete',
  authenticate,
  validate({ params: schema.notificationIdParamSchema }),
  controller.remove,
);

// ── Chat ──────────────────────────────────────────────────────────────────────

// -- Admin: notification fan-out --------------------------------------------------

router.post(
  '/broadcast',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.broadcastSchema }),
  controller.broadcast,
);

const chat = Router();

/** GET /chat/getAll */
chat.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listConversationsSchema }),
  controller.getConversations,
);

/** GET /chat/getUnreadCount */
chat.get('/getUnreadCount', authenticate, controller.chatUnread);

/** GET /chat/getBlocked */
chat.get('/getBlocked', authenticate, controller.getBlocked);

/** POST /chat/block */
chat.post('/block', authenticate, validate({ body: schema.blockUserSchema }), controller.block);

/** POST /chat/unblock/:id */
chat.post(
  '/unblock/:id',
  authenticate,
  validate({ params: schema.blockIdParamSchema }),
  controller.unblock,
);

/** POST /chat/startConversation */
chat.post(
  '/startConversation',
  authenticate,
  validate({ body: schema.startConversationSchema }),
  controller.startConversation,
);

/** GET /chat/getMessages/:id */
chat.get(
  '/getMessages/:id',
  authenticate,
  validate({ params: schema.conversationIdParamSchema, query: schema.listConversationsSchema }),
  controller.getMessages,
);

/** POST /chat/:id/sendMessage */
chat.post(
  '/:id/sendMessage',
  authenticate,
  validate({ params: schema.conversationIdParamSchema, body: schema.sendMessageSchema }),
  controller.sendMessage,
);

/** POST /chat/:id/read */
chat.post(
  '/:id/read',
  authenticate,
  validate({ params: schema.conversationIdParamSchema, body: schema.readConversationSchema }),
  controller.markConversationRead,
);

/** DELETE /chat/:id/deleteMessage */
chat.delete(
  '/:id/deleteMessage',
  authenticate,
  validate({ params: schema.conversationIdParamSchema }),
  controller.deleteMessage,
);

export const notificationRoutes = router;
export const chatRoutes = chat;

// ── Tickets ───────────────────────────────────────────────────────────────────

const tickets = Router();

/** GET /tickets/getCategories */
tickets.get('/getCategories', authenticate, controller.getCategories);

/** POST /tickets/categories — admin */
tickets.post(
  '/categories',
  authenticate,
  ...controller.guards.admin,
  validate({ body: schema.ticketCategorySchema }),
  controller.createCategory,
);

/** GET /tickets/getStats — admin */
tickets.get('/getStats', authenticate, ...controller.guards.admin, controller.getStats);

/** GET /tickets/getAll */
tickets.get(
  '/getAll',
  authenticate,
  validate({ query: schema.listTicketsSchema }),
  controller.getTickets,
);

/** POST /tickets/createTicket */
tickets.post(
  '/createTicket',
  authenticate,
  validate({ body: schema.createTicketSchema }),
  controller.createTicket,
);

/** GET /tickets/getById/:id */
tickets.get(
  '/getById/:id',
  authenticate,
  validate({ params: schema.ticketIdParamSchema }),
  controller.getById,
);

/** POST /tickets/:id/reply */
tickets.post(
  '/:id/reply',
  authenticate,
  validate({ params: schema.ticketIdParamSchema, body: schema.replyTicketSchema }),
  controller.reply,
);

/** PATCH /tickets/:id/updateStatus */
tickets.patch(
  '/:id/updateStatus',
  authenticate,
  validate({ params: schema.ticketIdParamSchema, body: schema.ticketStatusSchema }),
  controller.updateStatus,
);

/** PATCH /tickets/:id/assign — staff only */
tickets.patch(
  '/:id/assign',
  authenticate,
  ...controller.guards.admin,
  validate({ params: schema.ticketIdParamSchema, body: schema.assignTicketSchema }),
  controller.assign,
);

export const ticketRoutes = tickets;