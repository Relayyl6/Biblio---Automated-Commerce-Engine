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

    return jwt.sign(payload, this.secret, { expiresIn: '24h' });
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
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.replace('Bearer ', '');
      try {
        const payload = await this.verifyToken(token);
        // Inject merchant context into request
        request.merchantId = payload.sub;
        request.role = payload.role;
      } catch (err: any) {
        return reply.code(401).send({ error: err.message });
      }
    };
  }
}

export const authEngine = new SharedAuthEngine();
