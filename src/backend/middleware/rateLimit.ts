import { Context, Next } from 'hono';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

function cleanupExpired(now: number) {
  if (memoryStore.size > 200) {
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetAt) {
        memoryStore.delete(key);
      }
    }
  }
}

export function rateLimit(limit: number = 10, windowMs: number = 60000) {
  return async (c: Context, next: Next) => {
    const now = Date.now();
    cleanupExpired(now);
    // Obtener IP del cliente mediante cabeceras de Cloudflare o genéricas
    const clientIp = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     'anonymous';

    const path = c.req.path;
    const key = `${clientIp}:${path}`;

    let record = memoryStore.get(key);
    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + windowMs
      };
      memoryStore.set(key, record);
    } else {
      record.count++;
    }

    if (record.count > limit) {
      return c.json(
        { 
          error: 'Demasiadas solicitudes. Por favor espera un momento antes de reintentar.',
          retryAfterMs: Math.max(0, record.resetAt - now)
        }, 
        429
      );
    }

    await next();
  };
}
