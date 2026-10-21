import { Hono } from 'hono';
import { Env, User } from '../types';
import { requireAdmin } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { base64ToBytes } from '../services/crypto';

const mediaApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

/** Tipos de imagen permitidos. */
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif'
};

/**
 * Límites:
 *  - D1 (por defecto): 1.5 MB por imagen (límite de fila ~2 MB de D1).
 *  - R2 (si está enlazado): 10 MB por imagen.
 */
const MAX_BYTES_D1 = 1_500_000;
const MAX_BYTES_R2 = 10_000_000;

function extForMime(mime: string): string {
  return ALLOWED_MIME[mime.toLowerCase()] || 'jpg';
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sube una imagen (formato JSON base64 o multipart/form-data) y devuelve la
 * URL pública `/media/<clave>`.
 *
 * La imagen se guarda:
 *  - en R2, si el binding JY_STORAGE está configurado;
 *  - en la tabla `media` de D1, en caso contrario.
 */
mediaApp.post('/admin/upload', requireAdmin, rateLimit(40, 60000), async (c) => {
  try {
    const contentType = c.req.header('Content-Type') || '';
    let bytes: Uint8Array | null = null;
    let mimeType = '';

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      const data = String(body.data || '');
      const match = data.match(/^data:([A-Za-z0-9-]+\/[A-Za-z0-9-+.]+);base64,(.+)$/);

      if (!match) {
        return c.json({ error: 'Formato de imagen base64 inválido' }, 400);
      }
      mimeType = match[1].toLowerCase();
      bytes = base64ToBytes(match[2]);
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.parseBody();
      const file = formData['file'];
      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No se envió ningún archivo de imagen' }, 400);
      }
      mimeType = (file.type || 'image/jpeg').toLowerCase();
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      return c.json({ error: 'Content-Type no soportado. Usa multipart/form-data o application/json.' }, 400);
    }

    if (!bytes || bytes.byteLength === 0) {
      return c.json({ error: 'La imagen está vacía' }, 400);
    }

    if (!ALLOWED_MIME[mimeType]) {
      return c.json(
        { error: 'Formato no soportado. Usa JPG, PNG, WEBP, GIF o AVIF.' },
        400
      );
    }

    const useR2 = !!c.env.JY_STORAGE && typeof c.env.JY_STORAGE.put === 'function';
    const maxBytes = useR2 ? MAX_BYTES_R2 : MAX_BYTES_D1;

    if (bytes.byteLength > maxBytes) {
      const mb = (maxBytes / 1_000_000).toFixed(1);
      return c.json(
        {
          error: `La imagen es demasiado grande (${(bytes.byteLength / 1_000_000).toFixed(1)} MB). El máximo es ${mb} MB.`,
          maxBytes
        },
        413
      );
    }

    const hash = await sha256Hex(bytes);
    const key = `jy_${hash}.${extForMime(mimeType)}`;

    if (useR2) {
      await c.env.JY_STORAGE!.put(key, bytes as unknown as ArrayBuffer, {
        httpMetadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });
    } else {
      await c.env.JY_DB.prepare(
        "INSERT OR REPLACE INTO media (id, mime, size, bytes, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
        .bind(key, mimeType, bytes.byteLength, bytes.buffer as ArrayBuffer)
        .run();
    }

    return c.json({
      success: true,
      url: `/media/${key}`,
      key,
      size: bytes.byteLength,
      storage: useR2 ? 'r2' : 'd1'
    });
  } catch (err: any) {
    console.error('Error al subir imagen:', err);
    return c.json({ error: 'Error al procesar la subida de imagen' }, 500);
  }
});

/** Lista los medios almacenados (solo administradora). */
mediaApp.get('/admin/list', requireAdmin, async (c) => {
  try {
    const res = await c.env.JY_DB.prepare(
      'SELECT id, mime, size, created_at FROM media ORDER BY created_at DESC LIMIT 200'
    ).all<{ id: string; mime: string; size: number; created_at: string }>();

    return c.json({ success: true, media: res.results || [] });
  } catch (err) {
    console.error('Error al listar medios:', err);
    return c.json({ error: 'Error al listar medios' }, 500);
  }
});

/** Elimina un medio almacenado (solo administradora). */
mediaApp.delete('/admin/:key', requireAdmin, async (c) => {
  try {
    const key = c.req.param('key') ?? '';
    if (!/^jy_[a-f0-9]{24}\.[a-z0-9]+$/.test(key)) {
      return c.json({ error: 'Clave de medio inválida' }, 400);
    }

    if (c.env.JY_STORAGE && typeof c.env.JY_STORAGE.delete === 'function') {
      await c.env.JY_STORAGE.delete(key);
    }
    await c.env.JY_DB.prepare('DELETE FROM media WHERE id = ?').bind(key).run();

    return c.json({ success: true, message: 'Medio eliminado' });
  } catch (err) {
    console.error('Error al eliminar medio:', err);
    return c.json({ error: 'Error al eliminar medio' }, 500);
  }
});

/**
 * Sirve una imagen almacenada con cabeceras de caché inmutable.
 * Funciona con R2 o, en su defecto, con la tabla `media` de D1.
 */
mediaApp.get('/:key', async (c) => {
  try {
    const key = c.req.param('key') ?? '';
    if (!/^jy_[a-f0-9]{24}\.[a-z0-9]+$/.test(key)) {
      return c.text('Imagen no encontrada', 404);
    }

    // 1. R2
    if (c.env.JY_STORAGE && typeof c.env.JY_STORAGE.get === 'function') {
      const object = await c.env.JY_STORAGE.get(key);
      if (!object) return c.text('Imagen no encontrada', 404);

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(object.body, { headers });
    }

    // 2. D1
    const row = await c.env.JY_DB.prepare('SELECT mime, bytes FROM media WHERE id = ?')
      .bind(key)
      .first<{ mime: string; bytes: ArrayBuffer | number[] }>();

    if (!row) return c.text('Imagen no encontrada', 404);

    const bytes = toBytes(row.bytes);
    if (!bytes || bytes.byteLength === 0) return c.text('Imagen no encontrada', 404);

    return new Response(bytes as unknown as ArrayBuffer, {
      headers: {
        'Content-Type': row.mime || 'image/jpeg',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err) {
    console.error('Error al servir imagen:', err);
    return c.text('Error al servir imagen', 500);
  }
});

/** D1 puede devolver un BLOB como ArrayBuffer o como arreglo de bytes. */
function toBytes(value: ArrayBuffer | number[] | Uint8Array | null): Uint8Array | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  return null;
}

export default mediaApp;
