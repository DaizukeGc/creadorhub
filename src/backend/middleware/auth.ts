import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { resolveSecret, verifyJWT } from '../services/crypto';
import { Env, User } from '../types';

type AppContext = Context<{ Bindings: Env; Variables: { user?: User } }>;

/**
 * Resuelve el usuario de la sesión actual.
 * La fuente de verdad es D1 (rol y estado activo), nunca el contenido del token.
 * El `token_version` permite revocar todas las sesiones (logout / cambio de clave).
 */
export async function getUserFromContext(c: AppContext): Promise<User | null> {
  const existing = c.get('user');
  if (existing) return existing;

  const token = getCookie(c, 'jy_auth');
  if (!token) return null;

  let payload: Record<string, any> | null = null;
  try {
    payload = await verifyJWT(token, resolveSecret(c.env));
  } catch (err) {
    console.error('Error al verificar sesión:', err);
    return null;
  }
  if (!payload?.userId) return null;

  const user = await c.env.JY_DB.prepare(
    'SELECT id, username, name, role, active, token_version, created_at FROM users WHERE id = ? AND active = 1'
  )
    .bind(String(payload.userId))
    .first<User>();

  if (!user) return null;

  // El token fue emitido con una versión anterior de credenciales -> sesión invalidada
  const tokenVersion = Number(payload.tokenVersion ?? 0);
  if (tokenVersion !== Number(user.token_version ?? 0)) return null;

  c.set('user', user);
  return user;
}

export async function authMiddleware(c: AppContext, next: Next) {
  await getUserFromContext(c);
  await next();
}

export async function requireAdmin(c: AppContext, next: Next) {
  const user = await getUserFromContext(c);
  if (!user) {
    return c.json({ error: 'Debes iniciar sesión para continuar.' }, 401);
  }
  if (user.role !== 'admin') {
    return c.json({ error: 'Acceso no autorizado. Se requiere cuenta de administradora.' }, 403);
  }
  await next();
}
