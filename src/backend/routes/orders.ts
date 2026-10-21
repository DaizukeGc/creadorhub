import { Hono } from 'hono';
import { Env, User, Product, Order, OrderStatus, ORDER_STATUSES } from '../types';
import { rateLimit } from '../middleware/rateLimit';
import { requireAdmin, getUserFromContext } from '../middleware/auth';
import { getStoreConfig, whatsappLink } from '../services/config';

const ordersApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

const MAX_ITEMS = 30;
const MAX_QTY = 99;

/** Genera un código de rastreo legible y suficientemente único. */
function generateTrackingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const random = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    suffix += alphabet[random[i] % alphabet.length];
  }
  return `JY-${suffix}`;
}

/** Checkout con recálculo inmutable en el servidor. */
ordersApp.post('/checkout', rateLimit(10, 60000), async (c) => {
  try {
    const body = await c.req.json();
    const { items, customer, couponCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'El carrito no contiene productos' }, 400);
    }
    if (items.length > MAX_ITEMS) {
      return c.json({ error: 'Demasiados productos en un solo pedido' }, 400);
    }

    const customerName = String(customer?.name || '').trim();
    const customerPhone = String(customer?.phone || '').trim();
    const customerCity = String(customer?.city || '').trim();
    const customerAddress = String(customer?.address || '').trim();
    const customerNotes = String(customer?.notes || '').trim();

    if (!customerName || !customerPhone || !customerCity || !customerAddress) {
      return c.json(
        { error: 'Por favor completa todos los datos de envío (nombre, teléfono, ciudad y dirección)' },
        400
      );
    }
    if (customerName.length > 120 || customerAddress.length > 300 || customerNotes.length > 500) {
      return c.json({ error: 'Alguno de los datos de envío es demasiado largo' }, 400);
    }

    // 1. Recalcular precios reales en el servidor (el cliente nunca marca el precio)
    const productIds = [...new Set(items.map((i: any) => Number(i.id)).filter(id => Number.isFinite(id)))];
    if (productIds.length === 0) {
      return c.json({ error: 'Los productos seleccionados no son válidos' }, 400);
    }

    const placeholders = productIds.map(() => '?').join(',');
    const dbProductsRes = await c.env.JY_DB.prepare(
      `SELECT id, name, price, stock, category FROM products WHERE id IN (${placeholders}) AND is_active = 1`
    )
      .bind(...productIds)
      .all<Product>();

    const dbProductsMap = new Map<number, Product>();
    (dbProductsRes.results || []).forEach(p => dbProductsMap.set(p.id, p));

    let subtotal = 0;
    const validatedItems: Array<{ id: number; name: string; price: number; quantity: number; total: number }> = [];
    const stockErrors: string[] = [];

    for (const item of items) {
      const p = dbProductsMap.get(Number(item.id));
      if (!p) continue;

      const qty = Math.max(1, Math.min(MAX_QTY, Math.floor(Number(item.quantity) || 1)));
      const lineTotal = p.price * qty;
      subtotal += lineTotal;

      if (p.stock < qty) {
        stockErrors.push(
          p.stock === 0
            ? `«${p.name}» está agotado`
            : `«${p.name}» solo tiene ${p.stock} unidad(es) disponibles`
        );
      }

      validatedItems.push({ id: p.id, name: p.name, price: p.price, quantity: qty, total: lineTotal });
    }

    if (validatedItems.length === 0) {
      return c.json({ error: 'Los productos seleccionados ya no están disponibles' }, 400);
    }
    if (stockErrors.length > 0) {
      return c.json({ error: `Sin inventario suficiente. ${stockErrors.join('; ')}.` }, 409);
    }

    // 2. Validar cupón en D1 si fue suministrado
    let discount = 0;
    let appliedCoupon: string | null = null;

    if (couponCode) {
      const cleanCode = String(couponCode).trim().toUpperCase();
      const dbCoupon = await c.env.JY_DB.prepare(
        'SELECT code, discount_pct, active FROM coupons WHERE code = ? AND active = 1'
      )
        .bind(cleanCode)
        .first<{ code: string; discount_pct: number; active: number }>();

      if (dbCoupon) {
        appliedCoupon = dbCoupon.code;
        discount = Math.round((subtotal * dbCoupon.discount_pct) / 100);
      }
    }

    const total = Math.max(0, subtotal - discount);

    // 3. Código de rastreo
    const trackingCode = generateTrackingCode();

    // 4. Guardar pedido + items + inventario en un único lote atómico
    const session = await getUserFromContext(c);
    const statements: D1PreparedStatement[] = [
      c.env.JY_DB.prepare(`
        INSERT INTO orders (id, user_id, customer_name, customer_phone, customer_city, customer_address, customer_notes, subtotal, discount, total, coupon_code, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
      `).bind(
        trackingCode,
        session?.id ?? null,
        customerName,
        customerPhone,
        customerCity,
        customerAddress,
        customerNotes,
        subtotal,
        discount,
        total,
        appliedCoupon
      )
    ];

    for (const it of validatedItems) {
      statements.push(
        c.env.JY_DB.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, total_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(trackingCode, it.id, it.name, it.price, it.quantity, it.total)
      );

      // Descuento de inventario condicionado a que haya stock suficiente
      statements.push(
        c.env.JY_DB.prepare(`
          UPDATE products SET stock = stock - ?, sold = sold + ?
          WHERE id = ? AND stock >= ?
        `).bind(it.quantity, it.quantity, it.id, it.quantity)
      );
    }

    const batchResult = await c.env.JY_DB.batch(statements);

    // Si alguna actualización de stock no aplicó cambios, no había stock suficiente
    const stockFailed = validatedItems.some(
      (_, i) => (batchResult[2 + i * 2]?.meta?.changes ?? 0) === 0
    );
    if (stockFailed) {
      return c.json({ error: 'El inventario cambió mientras procesábamos tu pedido. Intenta de nuevo.' }, 409);
    }

    // 5. Mensaje oficial para WhatsApp
    const config = await getStoreConfig(c.env);
    const moneyFormat = (n: number) => `$${n.toLocaleString('es-CO')}`;
    let msg = `*Hola ${config.storeName}, quiero confirmar mi pedido*\n\n`;
    for (const it of validatedItems) {
      msg += `• ${it.quantity}x ${it.name} - ${moneyFormat(it.total)}\n`;
    }
    msg += `\nSubtotal: ${moneyFormat(subtotal)}\n`;
    if (discount > 0 && appliedCoupon) {
      msg += `Descuento (${appliedCoupon}): -${moneyFormat(discount)}\n`;
    }
    msg += `*TOTAL A PAGAR: ${moneyFormat(total)}*\n\n`;
    msg += `*Datos de entrega:*\n`;
    msg += `• Nombre: ${customerName}\n`;
    msg += `• Celular: ${customerPhone}\n`;
    msg += `• Ciudad: ${customerCity}\n`;
    msg += `• Dirección: ${customerAddress}\n`;
    if (customerNotes) {
      msg += `• Notas: ${customerNotes}\n`;
    }
    msg += `\n*Código de rastreo:* ${trackingCode}\n`;
    msg += `¡Muchas gracias! ✨`;

    return c.json({
      success: true,
      trackingCode,
      subtotal,
      discount,
      total,
      whatsappUrl: whatsappLink(config.whatsapp, msg),
      items: validatedItems
    });
  } catch (err: any) {
    console.error('Error en /api/orders/checkout:', err);
    return c.json({ error: 'Error al procesar el pedido' }, 500);
  }
});

/** Rastreo de pedidos por código para el cliente. */
ordersApp.get('/track/:id', rateLimit(30, 60000), async (c) => {
  try {
    const code = (c.req.param('id') ?? '').trim().toUpperCase();
    const order = await c.env.JY_DB.prepare(
      'SELECT id, customer_name, subtotal, discount, total, status, created_at FROM orders WHERE id = ?'
    )
      .bind(code)
      .first<any>();

    if (!order) {
      return c.json({ error: 'Código de pedido no encontrado' }, 404);
    }

    const itemsRes = await c.env.JY_DB.prepare(
      'SELECT product_name, unit_price, quantity, total_price FROM order_items WHERE order_id = ?'
    )
      .bind(code)
      .all<any>();

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

/** Rutas administrativas de pedidos (solo mamá). */
ordersApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const ordersRes = await c.env.JY_DB.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT 200'
    ).all<Order>();

    const orders = ordersRes.results || [];

    // Cargar todos los items en una sola consulta (evita N+1)
    const itemsByOrder = new Map<string, any[]>();
    if (orders.length > 0) {
      const placeholders = orders.map(() => '?').join(',');
      const itemsRes = await c.env.JY_DB.prepare(
        `SELECT order_id, product_name, unit_price, quantity, total_price FROM order_items WHERE order_id IN (${placeholders})`
      )
        .bind(...orders.map(o => o.id))
        .all<any>();

      for (const item of itemsRes.results || []) {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push(item);
        itemsByOrder.set(item.order_id, list);
      }
    }

    const ordersWithItems = orders.map(o => ({
      ...o,
      items: itemsByOrder.get(o.id) || []
    }));

    return c.json({ success: true, orders: ordersWithItems });
  } catch (err) {
    console.error('Error al listar pedidos:', err);
    return c.json({ error: 'Error al listar pedidos' }, 500);
  }
});

ordersApp.patch('/admin/:id/status', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const status = String(body.status || '') as OrderStatus;

    if (!ORDER_STATUSES.includes(status)) {
      return c.json({ error: 'Estado de pedido inválido' }, 400);
    }

    const res = await c.env.JY_DB.prepare('UPDATE orders SET status = ? WHERE id = ?')
      .bind(status, id)
      .run();

    if (!res.meta.changes) {
      return c.json({ error: 'Pedido no encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Estado actualizado' });
  } catch (err) {
    console.error('Error al actualizar estado de pedido:', err);
    return c.json({ error: 'Error al actualizar estado de pedido' }, 500);
  }
});

export default ordersApp;
