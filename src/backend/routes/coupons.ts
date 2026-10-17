import { Hono } from 'hono';
import { Env, User, Coupon } from '../types';
import { requireAdmin } from '../middleware/auth';

const couponsApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Listar cupones activos para la ruleta
couponsApp.get('/', async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT id, code, discount_pct, active FROM coupons WHERE active = 1'
    ).all<Coupon>();
    return c.json({ success: true, coupons: res.results || [] });
  } catch (err) {
    return c.json({ error: 'Error al consultar cupones' }, 500);
  }
});

// Validar cupón introducido en el carrito
couponsApp.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const code = (body.code || '').trim().toUpperCase();

    if (!code) {
      return c.json({ valid: false, message: 'Ingresa un código de cupón' }, 400);
    }

    const coupon = await c.env.JY_DB.prepare(
      'SELECT code, discount_pct, active FROM coupons WHERE code = ? AND active = 1'
    ).bind(code).first<Coupon>();

    if (!coupon) {
      return c.json({ valid: false, message: 'Cupón no válido o expirado' });
    }

    return c.json({
      valid: true,
      code: coupon.code,
      discount_pct: coupon.discount_pct,
      message: `¡Cupón ${coupon.code} aplicado con ${coupon.discount_pct}% de descuento!`
    });
  } catch (err) {
    return c.json({ error: 'Error al validar cupón' }, 500);
  }
});

// Rutas Administrativas de Cupones (Solo Mamá)
couponsApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT * FROM coupons ORDER BY id DESC'
    ).all<Coupon>();
    return c.json({ success: true, coupons: res.results || [] });
  } catch (err) {
    return c.json({ error: 'Error al listar cupones' }, 500);
  }
});

couponsApp.post('/admin/create', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const code = (body.code || '').trim().toUpperCase();
    const discount_pct = Number(body.discount_pct);

    if (!code || isNaN(discount_pct) || discount_pct <= 0 || discount_pct > 90) {
      return c.json({ error: 'Código y porcentaje de descuento válidos son obligatorios' }, 400);
    }

    await c.env.JY_DB.prepare(
      'INSERT INTO coupons (code, discount_pct, active) VALUES (?, ?, 1)'
    ).bind(code, discount_pct).run();

    return c.json({ success: true, message: 'Cupón creado exitosamente' });
  } catch (err: any) {
    if (String(err).includes('UNIQUE')) {
      return c.json({ error: 'Ese código de cupón ya existe' }, 400);
    }
    return c.json({ error: 'Error al crear cupón' }, 500);
  }
});

couponsApp.patch('/admin/:id/toggle', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    const coupon = await c.env.JY_DB.prepare('SELECT active FROM coupons WHERE id = ?').bind(id).first<any>();
    if (!coupon) return c.json({ error: 'Cupón no encontrado' }, 404);

    const newActive = coupon.active ? 0 : 1;
    await c.env.JY_DB.prepare('UPDATE coupons SET active = ? WHERE id = ?').bind(newActive, id).run();

    return c.json({ success: true, active: newActive });
  } catch (err) {
    return c.json({ error: 'Error al modificar cupón' }, 500);
  }
});

couponsApp.delete('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    await c.env.JY_DB.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Cupón eliminado' });
  } catch (err) {
    return c.json({ error: 'Error al eliminar cupón' }, 500);
  }
});

export default couponsApp;
