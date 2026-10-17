import { Hono } from 'hono';
import { Env, User } from '../types';
import { verifyPassword, hashPassword, createJWT } from '../services/crypto';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin, getUserFromContext } from '../middleware/auth';

const authApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Login exclusivo para la administradora (con rate limit de 5 intentos por minuto)
authApp.post('/login', rateLimit(5, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const username = (body.username || '').trim().toLowerCase();
    const password = body.password || '';

    if (!username || !password) {
      return c.json({ error: 'Usuario y contraseña requeridos' }, 400);
    }

    const user = await c.env.JY_DB.prepare(
      'SELECT id, username, password_hash, password_salt, name, role, active FROM users WHERE username = ?'
    ).bind(username).first<User>();

    if (!user || !user.active) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!valid) {
      return c.json({ error: 'Credenciales inválidas' }, 401);
    }

    // Crear JWT
    const token = await createJWT({ userId: user.id, username: user.username, role: user.role }, c.env.JWT_SECRET);

    // Configurar cookie HttpOnly y Secure
    c.header('Set-Cookie', `jy_auth=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);

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

// Cerrar sesión
authApp.post('/logout', (c) => {
  c.header('Set-Cookie', 'jy_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  return c.json({ success: true, message: 'Sesión cerrada exitosamente' });
});

// Cambiar contraseña desde el panel de la administradora
authApp.post('/change-password', requireAdmin, async (c) => {
  try {
    const user = c.get('user')!;
    const body = await c.req.json();
    const currentPass = body.currentPassword || '';
    const newPass = body.newPassword || '';

    if (!newPass || newPass.length < 6) {
      return c.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, 400);
    }

    // Obtener hash actual de la base de datos
    const dbUser = await c.env.JY_DB.prepare(
      'SELECT password_hash, password_salt FROM users WHERE id = ?'
    ).bind(user.id).first<User>();

    if (!dbUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    const valid = await verifyPassword(currentPass, dbUser.password_hash, dbUser.password_salt);
    if (!valid) {
      return c.json({ error: 'La contraseña actual no es correcta' }, 400);
    }

    // Hashear nueva contraseña
    const { hash, salt } = await hashPassword(newPass);
    await c.env.JY_DB.prepare(
      'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
    ).bind(hash, salt, user.id).run();

    return c.json({ success: true, message: 'Contraseña actualizada con éxito' });
  } catch (err) {
    return c.json({ error: 'Error al cambiar contraseña' }, 500);
  }
});

export default authApp;
