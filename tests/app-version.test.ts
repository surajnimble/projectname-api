import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { isVersionOlderThan } from '../src/utils/version';
import { getAppUpdatePolicy } from '../src/services/settings.service';
import { createApp } from '../src/app';

vi.mock('../src/services/settings.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/settings.service')>();
  return {
    ...actual,
    getAppUpdatePolicy: vi.fn(async () => ({
      forceUpdate: false,
      minVersion: '',
      latestVersion: '',
      message: '',
    })),
  };
});

const policy = vi.mocked(getAppUpdatePolicy);

describe('app version comparison', () => {
  it('orders numeric segments rather than comparing strings', () => {
    expect(isVersionOlderThan('1.9.0', '1.10.0')).toBe(true);
    expect(isVersionOlderThan('1.10.0', '1.9.0')).toBe(false);
    expect(isVersionOlderThan('1.0.9', '1.1.0')).toBe(true);
  });

  it('treats a missing segment as zero', () => {
    expect(isVersionOlderThan('1.2', '1.2.0')).toBe(false);
    expect(isVersionOlderThan('1.2', '1.2.1')).toBe(true);
    expect(isVersionOlderThan('1', '1.0.1')).toBe(true);
  });

  it('tolerates a v prefix and build metadata', () => {
    expect(isVersionOlderThan('v1.0.0', '1.0.1')).toBe(true);
    expect(isVersionOlderThan('1.4.2+17', '1.4.2')).toBe(false);
  });

  it('never blocks a client that does not identify its version', () => {
    expect(isVersionOlderThan('', '1.0.0')).toBe(false);
    expect(isVersionOlderThan('1.0.0', '')).toBe(false);
    expect(isVersionOlderThan('unknown', '1.0.0')).toBe(false);
  });
});

describe('force update guard', () => {
  let app: express.Application;

  beforeEach(() => {
    policy.mockReset();
    policy.mockResolvedValue({
      forceUpdate: false,
      minVersion: '',
      latestVersion: '',
      message: '',
    });
    app = createApp();
  });

  const android = { 'x-platform': 'ANDROID', 'x-app-version': '1.0.0' };

  it('answers 426 APP_UPDATE_REQUIRED when the build is below the minimum', async () => {
    policy.mockResolvedValue({
      forceUpdate: true,
      minVersion: '2.0.0',
      latestVersion: '2.1.0',
      message: '',
    });

    const res = await request(app).get('/api/v1/users/getProfile').set(android);

    expect(res.status).toBe(426);
    expect(res.body.status).toBe(false);
    expect(res.body.message).toContain('APP_UPDATE_REQUIRED');
    expect(res.body.result).toEqual({});
  });

  it('uses the admin-authored message when one is set', async () => {
    policy.mockResolvedValue({
      forceUpdate: true,
      minVersion: '2.0.0',
      latestVersion: '2.1.0',
      message: 'Please update from the Play Store.',
    });

    const res = await request(app).get('/api/v1/users/getProfile').set(android);

    expect(res.status).toBe(426);
    expect(res.body.message).toContain('Please update from the Play Store.');
  });

  it('never blocks a build at or above the minimum', async () => {
    policy.mockResolvedValue({
      forceUpdate: true,
      minVersion: '2.0.0',
      latestVersion: '2.1.0',
      message: '',
    });

    const res = await request(app)
      .get('/api/v1/users/getProfile')
      .set({ 'x-platform': 'ANDROID', 'x-app-version': '2.1.0' });

    expect(res.status).not.toBe(426);
  });

  it('never blocks WEB, which cannot act on an upgrade prompt', async () => {
    policy.mockResolvedValue({
      forceUpdate: true,
      minVersion: '2.0.0',
      latestVersion: '2.1.0',
      message: '',
    });

    const res = await request(app)
      .get('/api/v1/users/getProfile')
      .set({ 'x-platform': 'WEB', 'x-app-version': '0.1.0' });

    expect(res.status).not.toBe(426);
  });

  it('never blocks a request that carries no app version', async () => {
    policy.mockResolvedValue({
      forceUpdate: true,
      minVersion: '2.0.0',
      latestVersion: '2.1.0',
      message: '',
    });

    const res = await request(app).get('/api/v1/users/getProfile').set('x-platform', 'ANDROID');

    expect(res.status).not.toBe(426);
  });

  it('leaves the allow-listed paths open so the client can learn what to install', async () => {
    policy.mockResolvedValue({
      forceUpdate: true,
      minVersion: '2.0.0',
      latestVersion: '2.1.0',
      message: '',
    });

    const res = await request(app).get('/api/v1/health').set(android);

    expect(res.status).toBe(200);
  });

  it('fails open when the settings read fails', async () => {
    policy.mockRejectedValue(new Error('redis down'));

    const res = await request(app).get('/api/v1/users/getProfile').set(android);

    expect(res.status).not.toBe(426);
  });
});
