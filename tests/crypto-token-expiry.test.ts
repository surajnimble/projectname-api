import { describe, expect, it } from 'vitest';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { signAccessToken } from '../src/utils/crypto';

describe('access token expiry overrides', () => {
  const basePayload = {
    sub: 'user_123',
    role: 'CUSTOMER',
    vendorId: '',
    email: 'customer@example.test',
    sessionKey: 'imp_admin_123',
    deviceId: 'qa-device',
    impersonatedById: 'admin_123',
  };

  it('uses the requested impersonation lifetime instead of the global access-token lifetime', () => {
    const token = signAccessToken(basePayload, { expiresIn: 30 * 60 });
    const decoded = jwt.decode(token) as JwtPayload;

    expect(decoded.exp).toBeTypeOf('number');
    expect(decoded.iat).toBeTypeOf('number');
    expect(decoded.exp! - decoded.iat!).toBe(30 * 60);
    expect(decoded.impersonatedById).toBe('admin_123');
  });

  it('keeps the global expiry when no override is supplied', () => {
    const token = signAccessToken(basePayload);
    const decoded = jwt.decode(token) as JwtPayload;

    expect(decoded.exp! - decoded.iat!).toBeGreaterThan(0);
  });
});
