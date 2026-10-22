// Utilidades de catálogo: categorías canónicas, normalización de productos y
// migración de imágenes embebidas (base64) hacia el almacén de medios.
import { Env, Category, Product } from '../types';
import { bytesToBase64 } from './crypto';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Jabones', slug: 'jabones', display_order: 1 },
  { id: 2, name: 'Velas', slug: 'velas', display_order: 2 },
  { id: 3, name: 'Especiales', slug: 'especiales', display_order: 3 }
];

const ALL_SLUG = 'todos';

export async function getCategories(env: Env): Promise<Category[]> {
  try {
    const res = await env.JY_DB.prepare(
      'SELECT id, name, slug, display_order FROM categories ORDER BY display_order ASC, id ASC'
    ).all<Category>();
    if (res.results && res.results.length > 0) return res.results;
  } catch (err) {
    console.error('Error al leer categorías:', err);
  }
  return DEFAULT_CATEGORIES;
}

/** Quita acentos y pasa a minúsculas para comparar de forma tolerante. */
export function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Resuelve el valor recibido por el cliente (slug o nombre visible) al nombre
 * canónico de la categoría. Acepta "velas", "Velas", "Jabones", "jabones", etc.
 */
export function resolveCategoryName(categories: Category[], raw: string): string | null {
  const wanted = normalizeText(raw);
  if (!wanted || wanted === ALL_SLUG || wanted === 'all') return null;

  const bySlug = categories.find(c => normalizeText(c.slug) === wanted);
  if (bySlug) return bySlug.name;

  const byName = categories.find(c => normalizeText(c.name) === wanted);
  if (byName) return byName.name;

  return null;
}

/** Convierte la columna TEXT `features` (JSON) en un array de strings. */
export function parseFeatures(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.map(v => String(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Normaliza una fila de D1 al tipo Product del frontend. */
export function normalizeProduct(row: any): Product {
  return {
    ...row,
    features: parseFeatures(row.features),
    old_price: row.old_price ?? null,
    badge: row.badge ?? null,
    badge_type: row.badge_type ?? 'new',
    image: row.image ?? null,
    keywords: row.keywords ?? '',
    is_available: row.is_available === 0 ? 0 : 1
  };
}

const INLINE_IMAGE_PREFIX = 'data:image/';

let availabilityColumnChecked = false;

/**
 * Asegura que la columna `is_available` exista en la tabla products.
 * Permite marcar productos como agotados sin tener que migrar la base a mano.
 * Es idempotente: solo se ejecuta una vez por instancia.
 */
export async function ensureAvailabilityColumn(env: Env): Promise<void> {
  if (availabilityColumnChecked) return;
  try {
    const info = await env.JY_DB.prepare("PRAGMA table_info(products)").all<{ name: string }>();
    const columns = (info.results || []).map((c) => c.name);
    if (!columns.length) {
      // La tabla aún no existe: se creará con schema.sql.
      availabilityColumnChecked = true;
      return;
    }
    if (!columns.includes('is_available')) {
      await env.JY_DB.prepare(
        'ALTER TABLE products ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1'
      ).run();
      console.log('Migración aplicada: columna products.is_available creada');
    }
    availabilityColumnChecked = true;
  } catch (err) {
    console.error('Error ensuring is_available column:', err);
  }
}

let inlineMigrationChecked = false;

/**
 * Convierte imágenes que quedaron embebidas como data URL dentro de
 * products.image (por ejemplo, subidas antes de que existiera el almacén de
 * medios) a URLs `/media/<clave>`. Es idempotente y se ejecuta una sola vez.
 */
export async function migrateInlineImages(env: Env): Promise<void> {
  if (inlineMigrationChecked) return;
  try {
    const flag = await env.JY_DB.prepare("SELECT value FROM store_config WHERE key = 'media_migrated'")
      .first<{ value: string }>();
    if (flag?.value === '1') {
      inlineMigrationChecked = true;
      return;
    }

    const res = await env.JY_DB.prepare(
      "SELECT id, image FROM products WHERE image LIKE '" + INLINE_IMAGE_PREFIX + "%'"
    ).all<{ id: number; image: string }>();

    for (const row of res.results || []) {
      try {
        const match = row.image.match(/^data:([A-Za-z0-9-]+\/[A-Za-z0-9-+.]+);base64,(.+)$/);
        if (!match) continue;
        const mime = match[1].toLowerCase();
        if (!mime.startsWith('image/')) continue;

        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = Array.from(new Uint8Array(digest))
          .slice(0, 12)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
        const key = `jy_${hash}.${ext}`;

        await env.JY_DB.prepare(
          'INSERT OR REPLACE INTO media (id, mime, size, bytes, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
        )
          .bind(key, mime, bytes.byteLength, bytes.buffer as ArrayBuffer)
          .run();

        await env.JY_DB.prepare('UPDATE products SET image = ? WHERE id = ?')
          .bind(`/media/${key}`, row.id)
          .run();
      } catch (err) {
        console.error(`No se pudo migrar la imagen del producto ${row.id}:`, err);
      }
    }

    await env.JY_DB.prepare(
      "INSERT OR REPLACE INTO store_config (key, value) VALUES ('media_migrated', '1')"
    ).run();
    inlineMigrationChecked = true;
  } catch (err) {
    console.error('Error en migrateInlineImages:', err);
  }
}

/** Helper para generar data URLs (solo usado en desarrollo/pruebas). */
export function toDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}
