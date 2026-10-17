import { Hono } from 'hono';
import { Env, Product, User } from '../types';
import { requireAdmin } from '../middleware/auth';

const productsApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Listar productos activos (con soporte para filtrar por categoría)
productsApp.get('/', async (c) => {
  try {
    const category = c.req.query('category');
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params: any[] = [];

    if (category && category !== 'Todos') {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY display_order ASC, id ASC';

    const stmt = c.env.JY_DB.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all<any>() : await stmt.all<any>();

    const products: Product[] = (result.results || []).map(row => ({
      ...row,
      features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : row.features
    }));

    return c.json({ success: true, products });
  } catch (err: any) {
    console.error('Error al listar productos:', err);
    return c.json({ error: 'Error al consultar productos' }, 500);
  }
});

// Obtener producto por ID
productsApp.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const row = await c.env.JY_DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<any>();

    if (!row) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    const product: Product = {
      ...row,
      features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : row.features
    };

    return c.json({ success: true, product });
  } catch (err) {
    return c.json({ error: 'Error al consultar producto' }, 500);
  }
});

// Búsqueda semántica
productsApp.get('/search/semantic', async (c) => {
  try {
    const q = (c.req.query('q') || '').trim();
    if (!q) {
      return c.json({ success: true, products: [] });
    }

    // Consultar todos los productos para evaluar relevancia
    const result = await c.env.JY_DB.prepare('SELECT * FROM products WHERE is_active = 1').all<any>();
    const allProducts: Product[] = (result.results || []).map(row => ({
      ...row,
      features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : row.features
    }));

    const normQ = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const terms = normQ.split(/\s+/).filter(w => w.length > 2);

    // Búsqueda por peso semántico y términos clave
    const scored = allProducts.map(p => {
      let score = 0;
      const text = `${p.name} ${p.category} ${p.description} ${p.features.join(' ')} ${p.keywords || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const term of terms) {
        if (p.name.toLowerCase().includes(term)) score += 5;
        if (p.category.toLowerCase().includes(term)) score += 4;
        if (text.includes(term)) score += 2;
      }
      return { product: p, score };
    });

    const matches = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);

    return c.json({ success: true, products: matches.slice(0, 10) });
  } catch (err) {
    console.error('Error en búsqueda semántica:', err);
    return c.json({ error: 'Error en búsqueda' }, 500);
  }
});

// Rutas Administrativas de Productos (Solo Mamá)
productsApp.post('/admin/create', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { name, category, price, old_price, stock, badge, badge_type, image, features, description, keywords } = body;

    if (!name || !price || !category) {
      return c.json({ error: 'Nombre, categoría y precio son obligatorios' }, 400);
    }

    const featuresJson = JSON.stringify(Array.isArray(features) ? features : []);
    const res = await c.env.JY_DB.prepare(`
      INSERT INTO products (name, category, price, old_price, stock, badge, badge_type, image, features, description, keywords, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      name.trim(),
      category,
      Number(price),
      old_price ? Number(old_price) : null,
      stock ? Number(stock) : 10,
      badge ? badge.trim() : null,
      badge_type || 'new',
      image || null,
      featuresJson,
      description ? description.trim() : '',
      keywords ? keywords.trim() : ''
    ).run();

    return c.json({ success: true, id: res.meta.last_row_id });
  } catch (err: any) {
    console.error('Error al crear producto:', err);
    return c.json({ error: 'Error al crear producto en base de datos' }, 500);
  }
});

productsApp.put('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    const body = await c.req.json();
    const { name, category, price, old_price, stock, badge, badge_type, image, features, description, keywords, is_active } = body;

    const featuresJson = JSON.stringify(Array.isArray(features) ? features : []);

    await c.env.JY_DB.prepare(`
      UPDATE products SET
        name = ?, category = ?, price = ?, old_price = ?, stock = ?,
        badge = ?, badge_type = ?, image = ?, features = ?, description = ?,
        keywords = ?, is_active = ?
      WHERE id = ?
    `).bind(
      name.trim(),
      category,
      Number(price),
      old_price ? Number(old_price) : null,
      Number(stock || 0),
      badge ? badge.trim() : null,
      badge_type || 'new',
      image || null,
      featuresJson,
      description ? description.trim() : '',
      keywords ? keywords.trim() : '',
      is_active !== undefined ? Number(is_active) : 1,
      id
    ).run();

    return c.json({ success: true, message: 'Producto actualizado' });
  } catch (err) {
    return c.json({ error: 'Error al actualizar producto' }, 500);
  }
});

productsApp.delete('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    await c.env.JY_DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Producto eliminado' });
  } catch (err) {
    return c.json({ error: 'Error al eliminar producto' }, 500);
  }
});

export default productsApp;
