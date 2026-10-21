import { Context, Next } from 'hono';
import { Env } from '../types';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();
const MAX_ENTRIES = 5000;

/** Elimina entradas caducadas y, si seguimos por encima del límite, las más antiguas. */
function cleanupExpired(now: number) {
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetAt) memoryStore.delete(key);
  }
  if (memoryStore.size > MAX_ENTRIES) {
    const excess = memoryStore.size - MAX_ENTRIES;
    let removed = 0;
    for (const key of memoryStore.keys()) {
      if (removed >= excess) break;
      memoryStore.delete(key);
      removed++;
    }
  }
}

/**
 * Limitador de peticiones por IP + ruta.
 *
 * Nota: es un limitador en memoria por isolate. Cloudflare puede ejecutar el
 * mismo Worker en varios isolate, por lo que sirve como una primera línea de
 * defensa (y frena ataques automatizados simples), no como un control estricto.
 */
export function rateLimit(limit: number = 10, windowMs: number = 60000) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const now = Date.now();
    cleanupExpired(now);

    // CF-Connecting-IP lo inyecta Cloudflare y no es falsificable por el cliente.
    const clientIp = c.req.header('CF-Connecting-IP') || 'anonymous';
    const key = `${clientIp}:${c.req.path}`;

    let record = memoryStore.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      memoryStore.set(key, record);
    } else {
      record.count++;
    }

    if (record.count > limit) {
      c.header('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)));
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
