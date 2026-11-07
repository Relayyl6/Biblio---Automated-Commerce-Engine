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
  iss?: string;
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
    // 1. Attempt standard local JWT verification
    try {
      const decoded = jwt.verify(token, this.secret) as JwtPayload;
      return decoded;
    } catch (e: any) {
      if (e.name === 'TokenExpiredError') {
        const expiredErr: any = new Error('Token has expired');
        expiredErr.name = 'TokenExpiredError';
        expiredErr.code = 'TOKEN_EXPIRED';
        throw expiredErr;
      }

      // 2. If signature mismatch, check if it's a Clerk JWT or session token
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (clerkSecretKey) {
        try {
          const decoded = jwt.decode(token, { complete: true }) as any;
          const isClerk = decoded?.payload?.iss?.includes('clerk') || decoded?.payload?.sub?.startsWith('user_');
          if (isClerk) {
            // Verify with Clerk Tokens API
            const clerkRes = await fetch('https://api.clerk.com/v1/tokens/verify', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token }),
            });

            if (clerkRes.ok) {
              const clerkData = await clerkRes.json() as any;
              return {
                sub: clerkData.claims?.sub || decoded.payload.sub,
                role: 'merchant',
                iat: decoded.payload.iat,
                exp: decoded.payload.exp,
                iss: decoded.payload.iss,
              };
            }
          }
        } catch (_) {
          // Fall through to general invalid token error
        }
      }

      const invalidErr: any = new Error(`Invalid token: ${e.message}`);
      invalidErr.name = 'JsonWebTokenError';
      invalidErr.code = 'INVALID_TOKEN';
      throw invalidErr;
    }
  }

  /**
   * Fastify PreHandler Hook for route protection.
   */
  public getFastifyHook() {
    return async (request: any, reply: any) => {
      // Exclude health, legal, and auth-related endpoints from JWT enforcement using sanitized path
      const rawPath = request.routeOptions?.url || request.raw?.url || request.url || '';
      const path = rawPath.split('?')[0];

      const isPublicRoute =
        path === '/health' ||
        path.startsWith('/auth/') ||
        path.startsWith('/legal/') ||
        path.startsWith('/oauth/') ||
        path === '/voice/callback' ||
        path === '/pair';

      if (isPublicRoute) {
        return;
      }

      const authHeader = request.headers.authorization;
      const adminKeyHeader = request.headers['x-admin-key'];

      // Allow admin bypass if admin key is configured AND matches header
      if (process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY.trim() !== '' && adminKeyHeader === process.env.ADMIN_API_KEY) {
        request.merchantId = request.params?.id || request.params?.merchantId || request.body?.merchantId || 'admin';
        request.role = 'admin';
        return;
      }

      const DEFAULT_DEV_MERCHANT_ID = '4a7b2e63-c95f-4c71-9d08-2f05b68960ed';
      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // In local development or testing mode, gracefully fallback only when NO auth header was provided
        if (process.env.NODE_ENV !== 'production') {
          const candidate = request.params?.id || request.params?.merchantId || request.query?.merchantId || request.headers['x-merchant-id'];
          request.merchantId = candidate && isUuid(candidate) ? candidate : DEFAULT_DEV_MERCHANT_ID;
          request.role = 'merchant';
          return;
        }
        return reply.code(401).send({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
      }

      const token = authHeader.replace('Bearer ', '').trim();
      try {
        const payload = await this.verifyToken(token);
        // Inject merchant context into request
        request.merchantId = payload.sub;
        request.role = payload.role;
      } catch (err: any) {
        if (err.name === 'TokenExpiredError' || err.code === 'TOKEN_EXPIRED') {
          return reply.code(401).send({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return reply.code(401).send({ error: err.message || 'Invalid token', code: 'INVALID_TOKEN' });
      }
    };
  }

  /**
   * Enforce tenant isolation: verify that the authenticated caller has access to the target merchant.
   */
  public assertMerchantAccess(request: any, targetMerchantId: string): void {
    if (request.role === 'admin') return;
    if (request.merchantId && targetMerchantId && request.merchantId !== targetMerchantId) {
      const err: any = new Error("Forbidden: unauthorized access to another merchant's resource");
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }
}

export const authEngine = new SharedAuthEngine();
