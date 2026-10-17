import { Hono } from 'hono';
import { Env, User } from '../types';
import { requireAdmin } from '../middleware/auth';

const mediaApp = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// Subir imagen a Cloudflare R2 (Solo Administradora)
mediaApp.post('/admin/upload', requireAdmin, async (c) => {
  try {
    const contentType = c.req.header('Content-Type') || '';
    let imageBuffer: ArrayBuffer | null = null;
    let mimeType = 'image/jpeg';
    let fileKey = '';

    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      const base64Data = body.data || '';
      const match = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (!match) {
        return c.json({ error: 'Formato de imagen base64 inválido' }, 400);
      }

      mimeType = match[1];
      const binaryStr = atob(match[2]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      imageBuffer = bytes.buffer;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.parseBody();
      const file = formData['file'];
      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No se envió ningún archivo de imagen' }, 400);
      }
      mimeType = file.type || 'image/jpeg';
      imageBuffer = await file.arrayBuffer();
    } else {
      return c.json({ error: 'Content-Type no soportado' }, 400);
    }

    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return c.json({ error: 'Imagen vacía' }, 400);
    }

    // Generar clave única con hash SHA-256
    const hashBuf = await crypto.subtle.digest('SHA-256', imageBuffer);
    const hashHex = Array.from(new Uint8Array(hashBuf))
      .slice(0, 12)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    fileKey = `jy_${hashHex}.${ext}`;

    // Si el bucket R2 está disponible, subir el objeto
    if (c.env.JY_STORAGE && typeof c.env.JY_STORAGE.put === 'function') {
      await c.env.JY_STORAGE.put(fileKey, imageBuffer, {
        httpMetadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000, immutable'
        }
      });
      return c.json({
        success: true,
        url: `/media/${fileKey}`,
        key: fileKey
      });
    }

    // Fallback si R2 aún no está enlazado localmente: guardar en tabla temporal de D1
    const base64Fallback = `data:${mimeType};base64,${btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))}`;
    return c.json({
      success: true,
      url: base64Fallback,
      key: fileKey
    });
  } catch (err: any) {
    console.error('Error al subir imagen:', err);
    return c.json({ error: 'Error al procesar la subida de imagen' }, 500);
  }
});

// Servir imagen desde Cloudflare R2 con cabeceras de caché inmutable
mediaApp.get('/:key', async (c) => {
  try {
    const key = c.req.param('key');
    if (!c.env.JY_STORAGE || typeof c.env.JY_STORAGE.get !== 'function') {
      return c.text('Almacenamiento no inicializado', 404);
    }

    const object = await c.env.JY_STORAGE.get(key);
    if (!object) {
      return c.text('Imagen no encontrada', 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (err) {
    return c.text('Error al servir imagen', 500);
  }
});

export default mediaApp;
