// shared/src/auth/index.ts
//
// Role: Shared Authentication Matrix
// Provides central JWT issuance, verification, and Fastify auth hooks 
// for multi-tenant consumption across ace-whatsapp, ace-platform, and admin-portal.

import { dataIntelligence } from '../data-intelligence/engine.js';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string; // merchantId or adminId
  role: 'merchant' | 'admin';
  iat?: number;
  exp?: number;
}

export class SharedAuthEngine {
  private secret = process.env.JWT_SECRET || 'ace-dev-secret';

  public async issueToken(merchantId: string, role: 'merchant' | 'admin' = 'merchant'): Promise<string> {
    const payload: JwtPayload = {
      sub: merchantId,
      role
    };
    
    await dataIntelligence.auditLog({
      service: 'auth-engine',
      merchantId,
      action: 'token_issued',
      metadata: { role }
    });

    return jwt.sign(payload, this.secret, { expiresIn: '30d' });
  }

  public async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, this.secret) as JwtPayload;
      return decoded;
    } catch (e: any) {
      throw new Error(`Invalid token: ${e.message}`);
    }
  }

  /**
   * Fastify PreHandler Hook for route protection.
   */
  public getFastifyHook() {
    return async (request: any, reply: any) => {
      // Exclude health and auth-related endpoints from JWT enforcement
      const path = request.routerPath || request.url;
      if (path === '/health' || path.includes('/auth/')) {
        return;
      }

      const authHeader = request.headers.authorization;
      const adminKeyHeader = request.headers['x-admin-key'];

      // Allow admin bypass if admin key matches
      if (process.env.ADMIN_API_KEY && adminKeyHeader === process.env.ADMIN_API_KEY) {
        request.merchantId = request.params?.id || request.params?.merchantId || request.body?.merchantId || 'admin';
        request.role = 'admin';
        return;
      }

      const DEFAULT_DEV_MERCHANT_ID = '4a7b2e63-c95f-4c71-9d08-2f05b68960ed';
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // In local development or testing mode, gracefully fallback rather than breaking the app UI
        if (process.env.NODE_ENV !== 'production') {
          const candidate = request.params?.id || request.params?.merchantId || request.query?.merchantId || request.headers['x-merchant-id'];
          request.merchantId = candidate && isUuid(candidate) ? candidate : DEFAULT_DEV_MERCHANT_ID;
          request.role = 'merchant';
          return;
        }
        return reply.code(401).send({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.replace('Bearer ', '');
      try {
        const payload = await this.verifyToken(token);
        // Inject merchant context into request
        request.merchantId = payload.sub;
        request.role = payload.role;
      } catch (err: any) {
        // In dev mode, if token has expired or is invalid, don't break dev experience
        if (process.env.NODE_ENV !== 'production') {
          const candidate = request.params?.id || request.params?.merchantId || request.query?.merchantId || request.headers['x-merchant-id'];
          request.merchantId = candidate && isUuid(candidate) ? candidate : DEFAULT_DEV_MERCHANT_ID;
          request.role = 'merchant';
          return;
        }
        return reply.code(401).send({ error: err.message });
      }
    };
  }
}

export const authEngine = new SharedAuthEngine();
