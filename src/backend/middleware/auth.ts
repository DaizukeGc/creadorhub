import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWT } from '../services/crypto';
import { Env, User } from '../types';

export async function getUserFromContext(c: Context<{ Bindings: Env; Variables: { user?: User } }>): Promise<User | null> {
  const existing = c.get('user');
  if (existing) return existing;

  const token = getCookie(c, 'jy_auth');
  if (!token) return null;

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload || !payload.userId) return null;

    const user = await c.env.JY_DB.prepare(
      'SELECT id, username, name, role, active, created_at FROM users WHERE id = ? AND active = 1'
    ).bind(payload.userId).first<User>();

    if (user) {
      c.set('user', user);
      return user;
    }
  } catch (err) {
    console.error('Error al verificar usuario:', err);
  }
  return null;
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user?: User } }>, next: Next) {
  await getUserFromContext(c);
  await next();
}

export async function requireAdmin(c: Context<{ Bindings: Env; Variables: { user?: User } }>, next: Next) {
  const user = await getUserFromContext(c);
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Acceso no autorizado. Se requiere cuenta de administradora.' }, 401);
  }
  await next();
}
