import { Hono } from 'hono';
import { Env, User, Product, Order } from '../types';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin } from '../middleware/auth';

const ordersApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Checkout con recálculo inmutable en el servidor
ordersApp.post('/checkout', rateLimit(10, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const { items, customer, couponCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'El carrito no contiene productos' }, 400);
    }

    if (!customer || !customer.name || !customer.phone || !customer.city || !customer.address) {
      return c.json({ error: 'Por favor completa todos los datos de envío (nombre, teléfono, ciudad y dirección)' }, 400);
    }

    // 1. Consultar productos en D1 para recalcular precios reales (seguridad estricta)
    const productIds = items.map((i: any) => Number(i.id)).filter(id => !isNaN(id));
    const placeholders = productIds.map(() => '?').join(',');
    
    const dbProductsRes = await c.env.JY_DB.prepare(
      `SELECT id, name, price, stock, category FROM products WHERE id IN (${placeholders})`
    ).bind(...productIds).all<Product>();

    const dbProductsMap = new Map<number, Product>();
    (dbProductsRes.results || []).forEach(p => dbProductsMap.set(p.id, p));

    let subtotal = 0;
    const validatedItems: Array<{ id: number; name: string; price: number; quantity: number; total: number }> = [];

    for (const item of items) {
      const p = dbProductsMap.get(Number(item.id));
      if (!p) continue;
      const qty = Math.max(1, Math.min(99, Number(item.quantity) || 1));
      const lineTotal = p.price * qty;
      subtotal += lineTotal;

      validatedItems.push({
        id: p.id,
        name: p.name,
        price: p.price,
        quantity: qty,
        total: lineTotal
      });
    }

    if (validatedItems.length === 0) {
      return c.json({ error: 'Los productos seleccionados ya no están disponibles' }, 400);
    }

    // 2. Validar cupón en D1 si fue suministrado
    let discount = 0;
    let appliedCoupon: string | null = null;

    if (couponCode) {
      const cleanCode = String(couponCode).trim().toUpperCase();
      const dbCoupon = await c.env.JY_DB.prepare(
        'SELECT code, discount_pct, active FROM coupons WHERE code = ? AND active = 1'
      ).bind(cleanCode).first<any>();

      if (dbCoupon) {
        appliedCoupon = dbCoupon.code;
        discount = Math.round((subtotal * dbCoupon.discount_pct) / 100);
      }
    }

    const total = Math.max(0, subtotal - discount);

    // 3. Generar código de rastreo inmutable
    const trackingCode = `JY-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // 4. Guardar pedido en D1
    await c.env.JY_DB.prepare(`
      INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_city, customer_address, customer_notes, subtotal, discount, total, coupon_code, status)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
    `).bind(
      trackingCode,
      customer.name.trim(),
      customer.phone.trim(),
      customer.city.trim(),
      customer.address.trim(),
      (customer.notes || '').trim(),
      subtotal,
      discount,
      total,
      appliedCoupon
    ).run();

    // Guardar ítems del pedido
    for (const it of validatedItems) {
      await c.env.JY_DB.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(trackingCode, it.id, it.name, it.price, it.quantity, it.total).run();

      // Actualizar inventario y vendidos en D1
      await c.env.JY_DB.prepare(`
        UPDATE products SET 
          stock = MAX(0, stock - ?),
          sold = sold + ?
        WHERE id = ?
      `).bind(it.quantity, it.quantity, it.id).run();
    }

    // 5. Construir mensaje oficial para WhatsApp (+573150921542)
    const moneyFormat = (n: number) => `$${n.toLocaleString('es-CO')}`;
    let msg = `*Hola JY Velas y Jabones, quiero confirmar mi pedido*\n\n`;
    for (const it of validatedItems) {
      msg += `• ${it.quantity}x ${it.name} - ${moneyFormat(it.total)}\n`;
    }
    msg += `\nSubtotal: ${moneyFormat(subtotal)}\n`;
    if (discount > 0 && appliedCoupon) {
      msg += `Descuento (${appliedCoupon}): -${moneyFormat(discount)}\n`;
    }
    msg += `*TOTAL A PAGAR: ${moneyFormat(total)}*\n\n`;
    msg += `*Datos de entrega:*\n`;
    msg += `• Nombre: ${customer.name}\n`;
    msg += `• Celular: ${customer.phone}\n`;
    msg += `• Ciudad: ${customer.city}\n`;
    msg += `• Dirección: ${customer.address}\n`;
    if (customer.notes) {
      msg += `• Notas: ${customer.notes}\n`;
    }
    msg += `\n*Código de rastreo:* ${trackingCode}\n`;
    msg += `¡Muchas gracias! ✨`;

    const whatsappUrl = `https://wa.me/573150921542?text=${encodeURIComponent(msg)}`;

    return c.json({
      success: true,
      trackingCode,
      subtotal,
      discount,
      total,
      whatsappUrl,
      items: validatedItems
    });
  } catch (err: any) {
    console.error('Error en /api/orders/checkout:', err);
    return c.json({ error: 'Error al procesar el pedido' }, 500);
  }
});

// Rastreo de pedidos por código para el cliente
ordersApp.get('/track/:id', async (c) => {
  try {
    const code = c.req.param('id').trim().toUpperCase();
    const order = await c.env.JY_DB.prepare(
      'SELECT id, customer_name, subtotal, discount, total, status, created_at FROM orders WHERE id = ?'
    ).bind(code).first<any>();

    if (!order) {
      return c.json({ error: 'Código de pedido no encontrado' }, 404);
    }

    const itemsRes = await c.env.JY_DB.prepare(
      'SELECT product_name, unit_price, quantity, total_price FROM order_items WHERE order_id = ?'
    ).bind(code).all<any>();

    return c.json({
      success: true,
      order: {
        ...order,
        items: itemsRes.results || []
      }
    });
  } catch (err) {
    return c.json({ error: 'Error al consultar estado de pedido' }, 500);
  }
});

// Rutas Administrativas de Pedidos (Solo Mamá)
ordersApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const ordersRes = await c.env.JY_DB.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100'
    ).all<any>();

    const orders = ordersRes.results || [];
    // Cargar items de cada pedido
    const ordersWithItems = await Promise.all(
      orders.map(async (o) => {
        const items = await c.env.JY_DB.prepare(
          'SELECT product_name, unit_price, quantity, total_price FROM order_items WHERE order_id = ?'
        ).bind(o.id).all<any>();
        return {
          ...o,
          items: items.results || []
        };
      })
    );

    return c.json({ success: true, orders: ordersWithItems });
  } catch (err) {
    return c.json({ error: 'Error al listar pedidos' }, 500);
  }
});

ordersApp.patch('/admin/:id/status', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const status = body.status;

    const validStatuses = ['pendiente', 'en preparación', 'enviado', 'entregado'];
    if (!validStatuses.includes(status)) {
      return c.json({ error: 'Estado de pedido inválido' }, 400);
    }

    await c.env.JY_DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();
    return c.json({ success: true, message: 'Estado actualizado' });
  } catch (err) {
    return c.json({ error: 'Error al actualizar estado de pedido' }, 500);
  }
});

export default ordersApp;
