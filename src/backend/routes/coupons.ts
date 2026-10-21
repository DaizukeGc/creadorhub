import { Hono } from 'hono';
import { Env, User, Coupon } from '../types';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin } from '../middleware/auth';

const couponsApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

const MAX_DISCOUNT = 90;

function normalizeCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
}

/**
 * Valida un cupón. Endpoint público: no revela qué códigos existen,
 * solo si el código que el cliente intenta usar es válido.
 */
couponsApp.post('/validate', rateLimit(20, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const code = normalizeCode(body.code);

    if (!code) {
      return c.json({ error: 'Ingresa un código de cupón' }, 400);
    }

    const coupon = await c.env.JY_DB.prepare(
      'SELECT code, discount_pct, active FROM coupons WHERE code = ? AND active = 1'
    )
      .bind(code)
      .first<{ code: string; discount_pct: number; active: number }>();

    if (!coupon) {
      return c.json({ valid: false, message: 'Ese cupón no existe o ya no está activo.' });
    }

    return c.json({
      success: true,
      valid: true,
      code: coupon.code,
      discount_pct: coupon.discount_pct,
      message: `¡Cupón aplicado! ${coupon.discount_pct}% de descuento`
    });
  } catch (err) {
    console.error('Error al validar cupón:', err);
    return c.json({ error: 'Error al validar cupón' }, 500);
  }
});

/**
 * Premios de la ruleta. Los códigos de la ruleta son públicos por diseño
 * (se muestran en la rueda), por lo que se exponen solo los activos.
 */
couponsApp.get('/prizes', rateLimit(30, 60000), async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT code, discount_pct, label FROM coupons WHERE active = 1 ORDER BY id ASC'
    ).all<{ code: string; discount_pct: number; label: string }>();

    return c.json({ success: true, prizes: res.results || [] });
  } catch (err) {
    console.error('Error al obtener premios:', err);
    return c.json({ error: 'Error al obtener premios' }, 500);
  }
});

/** Listado de cupones (solo administradora). */
couponsApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const res = await c.env.JY_DB.prepare('SELECT * FROM coupons ORDER BY id DESC').all<Coupon>();
    return c.json({ success: true, coupons: res.results || [] });
  } catch (err) {
    console.error('Error al listar cupones:', err);
    return c.json({ error: 'Error al listar cupones' }, 500);
  }
});

couponsApp.post('/admin/create', requireAdmin, rateLimit(30, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const code = normalizeCode(body.code);

    if (!code || code.length < 3) {
      return c.json({ error: 'El código debe tener al menos 3 caracteres' }, 400);
    }

    const discountPct = Math.round(Number(body.discount_pct));
    if (!Number.isFinite(discountPct) || discountPct < 1 || discountPct > MAX_DISCOUNT) {
      return c.json({ error: `El descuento debe ser un número entero entre 1 y ${MAX_DISCOUNT}` }, 400);
    }

    const label = String(body.label || '').trim().slice(0, 40);

    const existing = await c.env.JY_DB.prepare('SELECT id FROM coupons WHERE code = ?').bind(code).first();
    if (existing) {
      return c.json({ error: 'Ya existe un cupón con ese código' }, 409);
    }

    await c.env.JY_DB.prepare('INSERT INTO coupons (code, discount_pct, label, active) VALUES (?, ?, ?, 1)')
      .bind(code, discountPct, label)
      .run();

    return c.json({ success: true, code, discount_pct: discountPct, label });
  } catch (err) {
    console.error('Error al crear cupón:', err);
    return c.json({ error: 'Error al crear cupón' }, 500);
  }
});

couponsApp.patch('/admin/:id/toggle', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    if (!Number.isFinite(id)) {
      return c.json({ error: 'Identificador de cupón inválido' }, 400);
    }

    const coupon = await c.env.JY_DB.prepare('SELECT active FROM coupons WHERE id = ?')
      .bind(id)
      .first<{ active: number }>();

    if (!coupon) {
      return c.json({ error: 'Cupón no encontrado' }, 404);
    }

    const nextActive = coupon.active ? 0 : 1;
    await c.env.JY_DB.prepare('UPDATE coupons SET active = ? WHERE id = ?').bind(nextActive, id).run();

    return c.json({ success: true, active: nextActive });
  } catch (err) {
    console.error('Error al cambiar estado del cupón:', err);
    return c.json({ error: 'Error al actualizar cupón' }, 500);
  }
});

couponsApp.delete('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    if (!Number.isFinite(id)) {
      return c.json({ error: 'Identificador de cupón inválido' }, 400);
    }

    await c.env.JY_DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Cupón eliminado' });
  } catch (err) {
    console.error('Error al eliminar cupón:', err);
    return c.json({ error: 'Error al eliminar cupón' }, 500);
  }
});

export default couponsApp;
