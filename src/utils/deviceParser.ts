import { UAParser } from 'ua-parser-js';
import { HEADER, DEVICE_HEADER_MAX } from '../config/app.config';
import { PLATFORM, Platform } from '../constants/roles';
import { nanoid } from 'nanoid';

export interface ParsedDevice {
  platform: Platform | 'OTHER';
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  model: string;
  manufacturer: string;
  isBot: boolean;
  userAgent: string;
  deviceType: string;
}

const BOT_REGEX =
  /bot|crawl|spider|slurp|curl|wget|python|java|okhttp|axios|node-fetch|postman|insomnia|headless|lighthouse|pingdom|monitoring|preview|facebookexternalhit|whatsapp|telegrambot|slackbot/i;

export const parseUserAgent = (userAgent: string): ParsedDevice => {
  const ua = userAgent || '';
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const osName = result.os?.name ?? '';
  const osVersion = result.os?.version ?? '';
  const browserName = result.browser?.name ?? '';
  const browserVersion = result.browser?.version ?? '';

  let platform: Platform | 'OTHER' = PLATFORM.OTHER;
  const deviceType = (result.device?.type ?? '').toString().toLowerCase();

  if (/android/i.test(osName)) platform = PLATFORM.ANDROID;
  else if (/ios|iphone|ipad|ipod/i.test(osName)) platform = PLATFORM.IOS;
  else if (ua.length === 0 || /webar|ember|chrome|firefox|safari|edge|opera/i.test(browserName)) {
    platform = PLATFORM.WEB;
  }

  const isBot =
    BOT_REGEX.test(ua) ||
    (result.device?.type === undefined &&
      browserName === '' &&
      osName === '' &&
      ua.length > 0 &&
      deviceType === '');

  return {
    platform,
    os: osName,
    osVersion,
    browser: browserName,
    browserVersion,
    model: result.device?.model ?? '',
    manufacturer: result.device?.vendor ?? '',
    isBot,
    userAgent: ua,
    deviceType,
  };
};

export const resolveDeviceId = (req: any): string => {
  const header = req.headers?.[HEADER.DEVICE_ID];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (fromHeader && String(fromHeader).trim()) return String(fromHeader).trim().slice(0, 64);

  const ip = (req.ip || '').replace('::ffff:', '');
  const ua = req.headers?.['user-agent'] || '';
  const seed = `${ip}|${ua}|${HEADER.PLATFORM}|${req.headers?.[HEADER.PLATFORM] || ''}`;
  return `srv_${hashToId(seed)}`;
};

const hashToId = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + nanoid(6);
};

export const resolvePlatform = (req: any, parsed: ParsedDevice): Platform | 'OTHER' => {
  const header = req.headers?.[HEADER.PLATFORM];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (fromHeader && String(fromHeader).toUpperCase() in PLATFORM) {
    return String(fromHeader).toUpperCase() as Platform;
  }
  return parsed.platform;
};

const readHeader = (req: any, name: string): string => {
  const raw = req.headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === undefined || value === null ? '' : String(value).trim();
};

/**
 * Device facts travel as headers so the same values sit on every request and
 * the tracking middleware can persist them without each schema having to
 * repeat the device object. An absent header is an empty string, never an
 * error — a web client is not expected to send app-only headers.
 */
export const resolveDeviceHeader = (req: any, name: string, maxLength: number): string =>
  readHeader(req, name).slice(0, maxLength);

export const resolveAppVersion = (req: any): string =>
  resolveDeviceHeader(req, HEADER.APP_VERSION, DEVICE_HEADER_MAX.APP_VERSION);

export const resolveDeviceModel = (req: any): string =>
  resolveDeviceHeader(req, HEADER.DEVICE_MODEL, DEVICE_HEADER_MAX.MODEL);

export const resolveLocale = (req: any): string =>
  resolveDeviceHeader(req, HEADER.LOCALE, DEVICE_HEADER_MAX.LOCALE);

export const resolveTimezone = (req: any): string =>
  resolveDeviceHeader(req, HEADER.TIMEZONE, DEVICE_HEADER_MAX.TIMEZONE);

export const resolveFcmToken = (req: any): string =>
  resolveDeviceHeader(req, HEADER.FCM_TOKEN, DEVICE_HEADER_MAX.FCM_TOKEN);
