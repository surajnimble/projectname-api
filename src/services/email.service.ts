import nodemailer, { Transporter } from 'nodemailer';
import { ENV, isSmtpConfigured, isTest } from '../config/env.config';
import { logger } from './logger.service';
import { renderTemplate } from './template.service';
import { EMAIL_TEMPLATE_KEY } from '../constants/tracking';
import { D } from '../utils/defaults';

export interface MailPayload {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  templateKey?: string;
  templateData?: Record<string, any>;
  from?: string;
  replyTo?: string;
}

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
  if (!isSmtpConfigured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_SECURE,
    auth: ENV.SMTP_USER ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS } : undefined,
  });

  return transporter;
};

export interface SendResult {
  sent: boolean;
  messageId: string;
  reason: string;
}

/**
 * Sends transactional mail. When SMTP is not configured (local/dev/test) the
 * message is logged instead of thrown, so flows keep working end to end.
 */
export const sendMail = async (payload: MailPayload): Promise<SendResult> => {
  let subject = D.str(payload.subject);
  let html = D.str(payload.html);
  let text = D.str(payload.text);

  if (payload.templateKey) {
    const rendered = await renderTemplate(payload.templateKey, payload.templateData ?? {});
    subject = payload.subject || rendered.subject;
    html = payload.html || rendered.html;
    text = payload.text || rendered.text;
  }

  if (!payload.to) {
    return { sent: false, messageId: '', reason: 'MISSING_RECIPIENT' };
  }

  const mailer = getTransporter();
  if (!mailer) {
    logger.info({ to: payload.to, subject }, '[email] SMTP not configured — skipped send');
    return { sent: false, messageId: '', reason: 'SMTP_NOT_CONFIGURED' };
  }

  if (isTest) {
    return { sent: false, messageId: '', reason: 'TEST_ENV' };
  }

  try {
    const info = await mailer.sendMail({
      from: payload.from
        ? `"${ENV.MAIL_FROM_NAME}" <${payload.from}>`
        : `"${ENV.MAIL_FROM_NAME}" <${ENV.MAIL_FROM_EMAIL}>`,
      to: payload.to,
      subject,
      html,
      text,
      replyTo: payload.replyTo,
    });

    logger.info({ to: payload.to, subject, messageId: info.messageId }, '[email] sent');
    return { sent: true, messageId: info.messageId ?? '', reason: '' };
  } catch (err) {
    logger.error({ err: (err as Error)?.message, to: payload.to }, '[email] send failed');
    return { sent: false, messageId: '', reason: 'SEND_FAILED' };
  }
};

export const sendOtpEmail = (to: string, otp: string, purpose: string): Promise<SendResult> =>
  sendMail({
    to,
    templateKey: EMAIL_TEMPLATE_KEY.RESET_PASSWORD,
    templateData: { otp, purpose, appName: ENV.APP_NAME },
  });

export const sendOrderConfirmation = (
  to: string,
  order: Record<string, any>,
): Promise<SendResult> =>
  sendMail({
    to,
    templateKey: EMAIL_TEMPLATE_KEY.ORDER_CONFIRM,
    templateData: { order, appName: ENV.APP_NAME },
  });

export const isMailConfigured = isSmtpConfigured;