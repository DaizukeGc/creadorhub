import { Hono } from 'hono';
import { Env, User, UserWithSecrets } from '../types';
import { verifyPassword, hashPassword, createJWT, resolveSecret, AuthConfigError } from '../services/crypto';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin, getUserFromContext } from '../middleware/auth';

const authApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

const COOKIE_NAME = 'jy_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function buildCookie(token: string, secure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function isSecureRequest(c: { req: { url: string } }): boolean {
  return c.req.url.startsWith('https://');
}

// Login exclusivo para la administradora (5 intentos por minuto)
authApp.post('/login', rateLimit(5, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!username || !password) {
      return c.json({ error: 'Usuario y contraseña requeridos' }, 400);
    }

    const user = await c.env.JY_DB.prepare(
      'SELECT id, username, password_hash, password_salt, name, role, active, token_version FROM users WHERE username = ?'
    )
      .bind(username)
      .first<UserWithSecrets>();

    if (!user || !user.active) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }

    let secret: string;
    try {
      secret = resolveSecret(c.env);
    } catch (err) {
      if (err instanceof AuthConfigError) {
        console.error(err.message);
        return c.json({ error: 'El portal aún no está configurado (falta el secreto de sesión).' }, 503);
      }
      throw err;
    }

    const token = await createJWT(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: Number(user.token_version ?? 0)
      },
      secret
    );

    c.header('Set-Cookie', buildCookie(token, isSecureRequest(c)));

    return c.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('Error en /api/auth/login:', err);
    return c.json({ error: 'Error interno de autenticación' }, 500);
  }
});

// Verificar sesión activa
authApp.get('/me', async (c) => {
  const user = await getUserFromContext(c);
  if (!user) {
    return c.json({ authenticated: false, user: null });
  }
  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  });
});

// Cerrar sesión: además de borrar la cookie, invalida los tokens emitidos
authApp.post('/logout', async (c) => {
  const user = await getUserFromContext(c);
  if (user) {
    await c.env.JY_DB.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?')
      .bind(user.id)
      .run();
  }
  c.header('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  return c.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

// Cambiar contraseña desde el panel de la administradora
authApp.post('/change-password', requireAdmin, rateLimit(10, 60000), async (c) => {
  try {
    const user = c.get('user')!;
    const body = await c.req.json();
    const currentPass = String(body.currentPassword || '');
    const newPass = String(body.newPassword || '');

    if (!newPass || newPass.length < 8) {
      return c.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, 400);
    }

    const dbUser = await c.env.JY_DB.prepare(
      'SELECT password_hash, password_salt FROM users WHERE id = ?'
    )
      .bind(user.id)
      .first<{ password_hash: string; password_salt: string }>();

    if (!dbUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    const valid = await verifyPassword(currentPass, dbUser.password_hash, dbUser.password_salt);
    if (!valid) {
      return c.json({ error: 'La contraseña actual no es correcta' }, 400);
    }

    const { hash, salt } = await hashPassword(newPass);
    // El token_version se incrementa -> todas las sesiones abiertas quedan invalidadas
    await c.env.JY_DB.prepare(
      'UPDATE users SET password_hash = ?, password_salt = ?, token_version = token_version + 1 WHERE id = ?'
    )
      .bind(hash, salt, user.id)
      .run();

    return c.json({ success: true, message: 'Contraseña actualizada. Vuelve a iniciar sesión.' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    return c.json({ error: 'Error al cambiar contraseña' }, 500);
  }
});

export default authApp;
