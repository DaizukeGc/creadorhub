import { Hono } from 'hono';
import { Env, Product, User } from '../types';
import { requireAdmin } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  getCategories,
  resolveCategoryName,
  normalizeProduct,
  parseFeatures,
  migrateInlineImages,
  ensureAvailabilityColumn
} from '../services/catalog';

const productsApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;
const MAX_KEYWORDS = 300;
const MAX_FEATURES = 20;
const MAX_IMAGE_URL = 500;

interface ProductInput {
  name?: string;
  category?: string;
  price?: number;
  old_price?: number | null;
  stock?: number;
  badge?: string | null;
  badge_type?: string | null;
  image?: string | null;
  features?: string[] | string;
  description?: string;
  keywords?: string | null;
  is_active?: number | boolean;
  is_available?: number | boolean;
  display_order?: number;
}

function validateProductInput(
  body: ProductInput,
  categories: { name: string }[],
  { partial }: { partial: boolean }
): { error?: string; data?: Record<string, unknown> } {
  const data: Record<string, unknown> = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) return { error: 'El nombre del producto es obligatorio' };
    if (name.length > MAX_NAME) return { error: `El nombre no puede superar ${MAX_NAME} caracteres` };
    data.name = name;
  }

  if (!partial || body.category !== undefined) {
    const categoryName = resolveCategoryName(
      categories as any,
      String(body.category ?? '')
    );
    if (!categoryName) {
      return {
        error: `Categoría inválida. Usa una de: ${categories.map(c => c.name).join(', ')}`
      };
    }
    data.category = categoryName;
  }

  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'El precio debe ser un número válido mayor o igual a 0' };
    }
    data.price = Math.round(price);
  }

  if (body.old_price !== undefined && body.old_price !== null && body.old_price !== ('' as unknown)) {
    const oldPrice = Number(body.old_price);
    if (!Number.isFinite(oldPrice) || oldPrice < 0) {
      return { error: 'El precio anterior debe ser un número válido' };
    }
    data.old_price = Math.round(oldPrice);
  } else if (!partial) {
    data.old_price = null;
  }

  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isFinite(stock) || stock < 0 || stock > 100000) {
      return { error: 'El stock debe ser un número válido entre 0 y 100000' };
    }
    data.stock = Math.round(stock);
  }

  if (body.badge !== undefined) {
    const badge = String(body.badge ?? '').trim();
    data.badge = badge ? badge.slice(0, 40) : null;
  }

  if (body.badge_type !== undefined) {
    const type = String(body.badge_type ?? 'new').trim().toLowerCase();
    const allowed = ['new', 'bestseller', 'premium', 'sale', 'limited'];
    data.badge_type = allowed.includes(type) ? type : 'new';
  }

  if (body.image !== undefined) {
    const image = String(body.image ?? '').trim();
    if (image.length > MAX_IMAGE_URL) {
      return { error: 'La URL de la imagen es demasiado larga' };
    }
    data.image = image || null;
  }

  if (body.features !== undefined) {
    const features = parseFeatures(body.features as any)
      .map(f => f.trim())
      .filter(Boolean)
      .slice(0, MAX_FEATURES);
    data.features = JSON.stringify(features);
  }

  if (body.description !== undefined) {
    data.description = String(body.description ?? '').trim().slice(0, MAX_DESCRIPTION);
  }

  if (body.keywords !== undefined) {
    data.keywords = String(body.keywords ?? '').trim().slice(0, MAX_KEYWORDS);
  }

  if (body.is_active !== undefined) {
    data.is_active = body.is_active ? 1 : 0;
  }

  if (body.is_available !== undefined) {
    data.is_available = body.is_available ? 1 : 0;
  }

  if (body.display_order !== undefined) {
    const order = Number(body.display_order);
    if (!Number.isFinite(order) || order < 0) {
      return { error: 'El orden de visualización debe ser un número válido' };
    }
    data.display_order = Math.round(order);
  }

  return { data };
}

// ---------------------------------------------------------------------------
// Catálogo público
// ---------------------------------------------------------------------------

/** Lista de categorías disponibles (para los filtros de la tienda). */
productsApp.get('/categories', async (c) => {
  const categories = await getCategories(c.env);
  return c.json({ success: true, categories });
});

/** Listar productos activos, con filtro opcional por categoría (slug o nombre). */
productsApp.get('/', async (c) => {
  try {
    await ensureAvailabilityColumn(c.env);
    await migrateInlineImages(c.env);
    const categories = await getCategories(c.env);
    const rawCategory = (c.req.query('category') || '').trim();

    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params: unknown[] = [];

    if (rawCategory) {
      const categoryName = resolveCategoryName(categories, rawCategory);
      if (!categoryName) {
        // Categoría desconocida: devolvemos vacío en vez de ignorar el filtro
        if (rawCategory.toLowerCase() !== 'todos' && rawCategory.toLowerCase() !== 'all') {
          return c.json({ success: true, products: [], categories });
        }
      } else {
        query += ' AND category = ?';
        params.push(categoryName);
      }
    }

    query += ' ORDER BY display_order ASC, id ASC';

    const stmt = c.env.JY_DB.prepare(query);
    const result = params.length
      ? await stmt.bind(...(params as any[])).all<any>()
      : await stmt.all<any>();

    const products = (result.results || []).map(normalizeProduct);
    return c.json({ success: true, products, categories });
  } catch (err: any) {
    console.error('Error al listar productos:', err);
    return c.json({ error: 'Error al consultar productos' }, 500);
  }
});

/** Búsqueda semántica (ponderada por nombre, categoría, descripción y palabras clave). */
productsApp.get('/search/semantic', async (c) => {
  try {
    const q = (c.req.query('q') || '').trim();
    if (!q) {
      return c.json({ success: true, products: [] });
    }

    const result = await c.env.JY_DB.prepare('SELECT * FROM products WHERE is_active = 1').all<any>();
    const allProducts: Product[] = (result.results || []).map(normalizeProduct);

    const normQ = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const terms = normQ.split(/\s+/).filter(w => w.length > 1);

    const scored = allProducts.map(p => {
      let score = 0;
      const name = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const category = p.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const text = `${p.name} ${p.category} ${p.description} ${p.features.join(' ')} ${p.keywords || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      for (const term of terms) {
        if (name.includes(term)) score += 5;
        if (category.includes(term)) score += 4;
        if (text.includes(term)) score += 2;
        if (p.keywords && p.keywords.toLowerCase().includes(term)) score += 3;
      }
      return { product: p, score };
    });

    const matches = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);

    return c.json({ success: true, products: matches.slice(0, 20) });
  } catch (err) {
    console.error('Error en búsqueda semántica:', err);
    return c.json({ error: 'Error en búsqueda' }, 500);
  }
});

/** Listado completo (incluye productos desactivados) para el panel de la mamá. */
productsApp.get('/admin/all', requireAdmin, async (c) => {
  try {
    await ensureAvailabilityColumn(c.env);
    const result = await c.env.JY_DB.prepare(
      'SELECT * FROM products ORDER BY is_active DESC, display_order ASC, id ASC'
    ).all<any>();
    return c.json({ success: true, products: (result.results || []).map(normalizeProduct) });
  } catch (err) {
    console.error('Error al listar productos (admin):', err);
    return c.json({ error: 'Error al consultar productos' }, 500);
  }
});

/** Obtener producto por ID. */
productsApp.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (!Number.isFinite(id)) {
      return c.json({ error: 'Identificador de producto inválido' }, 400);
    }

    const row = await c.env.JY_DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<any>();
    if (!row) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    // Los productos desactivados solo son visibles para la administradora
    if (!row.is_active) {
      const user = await c.env.JY_DB.prepare('SELECT role FROM users WHERE id = ?')
        .bind(c.get('user')?.id ?? '')
        .first<{ role: string }>();
      if (!user || user.role !== 'admin') {
        return c.json({ error: 'Producto no encontrado' }, 404);
      }
    }

    return c.json({ success: true, product: normalizeProduct(row) });
  } catch (err) {
    console.error('Error al consultar producto:', err);
    return c.json({ error: 'Error al consultar producto' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Panel de la mamá
// ---------------------------------------------------------------------------

/** Crear un producto nuevo. */
productsApp.post('/admin/create', requireAdmin, rateLimit(30, 60000), async (c) => {
  try {
    await ensureAvailabilityColumn(c.env);
    const body = (await c.req.json()) as ProductInput;
    const categories = await getCategories(c.env);

    const validation = validateProductInput(body, categories, { partial: false });
    if (validation.error) return c.json({ error: validation.error }, 400);

    const data = validation.data!;
    const nextOrder = await c.env.JY_DB.prepare(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM products'
    ).first<{ next: number }>();

    const res = await c.env.JY_DB.prepare(`
      INSERT INTO products (
        name, category, price, old_price, stock, badge, badge_type,
        image, features, description, keywords, is_active, is_available, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        data.name,
        data.category,
        data.price,
        data.old_price ?? null,
        data.stock ?? 10,
        data.badge ?? null,
        data.badge_type ?? 'new',
        data.image ?? null,
        data.features ?? '[]',
        data.description ?? '',
        data.keywords ?? '',
        data.is_active ?? 1,
        data.is_available ?? 1,
        data.display_order ?? Number(nextOrder?.next ?? 1)
      )
      .run();

    return c.json({ success: true, id: res.meta.last_row_id });
  } catch (err: any) {
    console.error('Error al crear producto:', err);
    return c.json({ error: 'Error al crear producto en base de datos' }, 500);
  }
});

/** Actualizar un producto (solo los campos enviados). */
productsApp.put('/admin/:id', requireAdmin, rateLimit(60, 60000), async (c) => {
  try {
    await ensureAvailabilityColumn(c.env);
    const id = parseInt(c.req.param('id') || '0');
    if (!Number.isFinite(id)) {
      return c.json({ error: 'Identificador de producto inválido' }, 400);
    }

    const body = ((await c.req.json().catch(() => ({}))) || {}) as ProductInput;
    const categories = await getCategories(c.env);

    const validation = validateProductInput(body, categories, { partial: true });
    if (validation.error) return c.json({ error: validation.error }, 400);

    const data = validation.data!;
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return c.json({ error: 'No hay cambios para guardar' }, 400);
    }

    const existing = await c.env.JY_DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    const assignments = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);

    const res = await c.env.JY_DB.prepare(`UPDATE products SET ${assignments} WHERE id = ?`)
      .bind(...(values as any[]), id)
      .run();

    if (!res.meta.changes) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    return c.json({ success: true, message: 'Producto actualizado' });
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    return c.json({ error: 'Error al actualizar producto' }, 500);
  }
});

/** Desactivar un producto (borrado lógico: conserva el historial de pedidos). */
productsApp.delete('/admin/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    if (!Number.isFinite(id)) {
      return c.json({ error: 'Identificador de producto inválido' }, 400);
    }

    const existing = await c.env.JY_DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
    if (!existing) {
      return c.json({ error: 'Producto no encontrado' }, 404);
    }

    await c.env.JY_DB.prepare('UPDATE products SET is_active = 0 WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Producto eliminado del catálogo' });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    return c.json({ error: 'Error al eliminar producto' }, 500);
  }
});

/** Borrado definitivo (solo desde el panel, con confirmación explícita). */
productsApp.delete('/admin/:id/permanent', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0');
    if (!Number.isFinite(id)) {
      return c.json({ error: 'Identificador de producto inválido' }, 400);
    }

    await c.env.JY_DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Producto eliminado definitivamente' });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    return c.json({ error: 'Error al eliminar producto' }, 500);
  }
});

export default productsApp;
