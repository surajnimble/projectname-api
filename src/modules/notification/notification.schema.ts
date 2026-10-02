import { z } from 'zod';
import { NotificationChannel, TicketPriority, TicketStatus } from '@prisma/client';
import { VALIDATION } from '../../messages/validation';
import { NAME } from '../../config/password.config';
import { common, paginationSchema } from '../../middlewares/validate.middleware';

const id = common.cuid;

const ERROR_EMPTY_MESSAGE = 'Message cannot be empty.';
const ERROR_MESSAGE_REQUIRED = 'Reply message is required.';
const D_arr = (v: any): any[] => (Array.isArray(v) ? v : []);

// ─── Notification ─────────────────────────────────────────────────────────────

export const listNotificationsSchema = z
  .object({
    type: z.enum(['ORDER', 'PAYMENT', 'PAYOUT', 'RETURN', 'TICKET', 'PROMO', 'SYSTEM', 'ALERT']).optional(),
    channel: z.nativeEnum(NotificationChannel).optional(),
    isRead: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

export const notificationIdParamSchema = z.object({ id });

export const markReadSchema = z
  .object({
    ids: z.array(id).min(1).max(100).optional(),
  })
  .strict();

/** PATCH /notifications/preferences */
export const preferencesSchema = z
  .object({
    preferences: z
      .array(
        z
          .object({
            channel: z.nativeEnum(NotificationChannel),
            eventType: z.string().trim().max(60),
            isEnabled: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const listConversationsSchema = z
  .object({
    isArchived: z.enum(['true', 'false']).optional(),
  })
  .merge(paginationSchema)
  .strict();

/** POST /chat/startConversation — a customer opens a thread with a shop. */
export const startConversationSchema = z
  .object({
    vendorId: id,
    subject: z.string().trim().max(NAME.TITLE_MAX_LENGTH).optional(),
    message: z
      .string()
      .trim()
      .min(1, ERROR_EMPTY_MESSAGE)
      .max(NAME.COMMENT_MAX_LENGTH),
  })
  .strict();

/** POST /chat/:id/sendMessage */
export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1, ERROR_EMPTY_MESSAGE).max(NAME.COMMENT_MAX_LENGTH),
    attachments: z.array(z.string().trim().max(300)).max(6).optional().default([]),
  })
  .strict();

/** POST /chat/:id/read */
export const readConversationSchema = z
  .object({
    lastReadAt: common.dateString.optional(),
  })
  .strict();

export const conversationIdParamSchema = z.object({ id });

/** POST /chat/block */
export const blockUserSchema = z
  .object({
    userId: id,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const blockIdParamSchema = z.object({ id });

// ─── Ticket ───────────────────────────────────────────────────────────────────

export const listTicketsSchema = z
  .object({
    status: z.nativeEnum(TicketStatus).optional(),
    priority: z.nativeEnum(TicketPriority).optional(),
    categoryId: id.optional(),
    assignedToId: id.optional(),
    search: z.string().trim().max(120).optional(),
  })
  .merge(paginationSchema)
  .strict();

/** POST /tickets/createTicket */
export const createTicketSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(4, VALIDATION.MIN_LENGTH('subject', 4))
      .max(NAME.TITLE_MAX_LENGTH),
    description: z.string().trim().max(NAME.COMMENT_MAX_LENGTH).optional(),
    categoryId: id.optional(),
    priority: z.nativeEnum(TicketPriority).optional().default('MEDIUM'),
    attachments: z.array(z.string().trim().max(300)).max(6).optional().default([]),
  })
  .strict();

/** POST /tickets/:id/reply */
export const replyTicketSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, ERROR_MESSAGE_REQUIRED)
      .max(NAME.COMMENT_MAX_LENGTH),
    /** Staff-only note, hidden from the customer. */
    isInternal: z.boolean().optional().default(false),
  })
  .strict();

/** PATCH /tickets/:id/status */
export const ticketStatusSchema = z
  .object({
    status: z.nativeEnum(TicketStatus),
    remark: z.string().trim().max(500).optional(),
  })
  .strict();

/** PATCH /tickets/:id/assign — admin */
export const assignTicketSchema = z
  .object({
    assignedToId: id.optional(),
  })
  .strict();

/** POST /tickets/categories — admin */
export const ticketCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, VALIDATION.MIN_LENGTH('name', 2))
      .max(NAME.TITLE_MAX_LENGTH),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.coerce.number().int().min(0).optional().default(0),
  })
  .strict();

export const ticketIdParamSchema = z.object({ id });

/** POST /admin/notifications/broadcast — admin */
export const broadcastSchema = z
  .object({
    userIds: z.array(id).max(5000).optional(),
    type: z.enum(['ORDER', 'PAYMENT', 'PAYOUT', 'RETURN', 'TICKET', 'PROMO', 'SYSTEM', 'ALERT']).default('PROMO'),
    channel: z.nativeEnum(NotificationChannel).optional().default('IN_APP'),
    title: z.string().trim().min(2, VALIDATION.MIN_LENGTH('title', 2)).max(120),
    body: z.string().trim().max(1000).optional(),
    data: z.record(z.unknown()).optional(),
    /** Send to every active user when no explicit list is given. */
    toAll: z.boolean().optional().default(false),
  })
  .strict()
  .refine((v) => Boolean(D_arr(v.userIds).length) || v.toAll, {
    message: 'Provide userIds or set toAll.',
  });

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;