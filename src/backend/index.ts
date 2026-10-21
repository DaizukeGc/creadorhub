import { Hono } from 'hono';
import { Env, User } from './types';
import { authMiddleware } from './middleware/auth';
import authApp from './routes/auth';
import productsApp from './routes/products';
import ordersApp from './routes/orders';
import couponsApp from './routes/coupons';
import reviewsApp from './routes/reviews';
import aiApp from './routes/ai';
import mediaApp from './routes/media';
import configApp from './routes/config';
import { generateSitemap, generateRobotsTxt, generateStructuredData, SsrContext } from './services/ssr';
import { getStoreConfig, getPublicUrl } from './services/config';
import { normalizeProduct } from './services/catalog';

const app = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

/**
 * CORS restringido: por defecto solo el mismo origen (la tienda y su panel
 * se sirven desde el mismo dominio). Se pueden abrir orígenes extra con la
 * variable ALLOWED_ORIGINS (separados por coma).
 */
function resolveAllowedOrigin(env: Env, origin: string, requestOrigin: string): string | undefined {
  if (!origin) return undefined;

  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (configured.length === 0) {
    // Sin configuración: solo permitimos peticiones del mismo origen
    return origin === requestOrigin ? origin : undefined;
  }

  return configured.includes(origin) ? origin : undefined;
}

// 1. Cabeceras de Seguridad y CORS
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');
});

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (!origin) return next();

  let requestOrigin = '';
  try {
    requestOrigin = new URL(c.req.url).origin;
  } catch {
    return next();
  }

  const allowed = resolveAllowedOrigin(c.env, origin, requestOrigin);
  if (!allowed) return next();

  c.header('Access-Control-Allow-Origin', allowed);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Vary', 'Origin');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  return next();
});

// 2. Middleware de autenticación global (para inyectar usuario de sesión si existe)
app.use('*', authMiddleware);

// 3. Montar APIs REST
app.route('/api/auth', authApp);
app.route('/api/products', productsApp);
app.route('/api/orders', ordersApp);
app.route('/api/coupons', couponsApp);
app.route('/api/reviews', reviewsApp);
app.route('/api/ai', aiApp);
app.route('/api/media', mediaApp);
app.route('/api/config', configApp);
// Las imágenes también se sirven en la raíz (/media/<clave>) para URLs limpias
app.route('/media', mediaApp);

// 4. Ruta secreta de administración para la mamá: /portal-jy
app.get('/portal-jy', async (c) => {
  if (c.env.ASSETS) {
    const url = new URL(c.req.url);
    url.pathname = '/portal.html';
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
  }
  return c.redirect('/portal.html');
});

// 5. SEO Técnico: Sitemap y Robots
app.get('/sitemap.xml', async (c) => {
  try {
    const baseUrl = getPublicUrl(c.env, c.req.raw);
    const prodsRes = await c.env.JY_DB.prepare(
      'SELECT * FROM products WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
    ).all<any>();
    const products = (prodsRes.results || []).map(normalizeProduct);
    const xml = generateSitemap(products, baseUrl);
    return c.text(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  } catch (err) {
    console.error('Error al generar sitemap:', err);
    return c.text('Error al generar sitemap', 500);
  }
});

app.get('/robots.txt', (c) => {
  const baseUrl = getPublicUrl(c.env, c.req.raw);
  return c.text(generateRobotsTxt(baseUrl), 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

// 6. SSR Parcial / Inyección de catálogo y JSON-LD en la ruta raíz
app.get('/', async (c) => {
  if (!c.env.ASSETS) {
    return c.text('JY Velas y Jabones API en el Edge activa.', 200);
  }

  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  const contentType = assetResponse.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return assetResponse;
  }

  try {
    const html = await assetResponse.text();

    const [prodsRes, statsRes, storeConfig] = await Promise.all([
      c.env.JY_DB.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY display_order ASC, id ASC LIMIT 12').all<any>(),
      c.env.JY_DB.prepare('SELECT COUNT(*) AS total, COALESCE(AVG(stars), 0) AS average FROM reviews')
        .first<{ total: number; average: number }>(),
      getStoreConfig(c.env)
    ]);

    const products = (prodsRes.results || []).map(normalizeProduct);
    const baseUrl = getPublicUrl(c.env, c.req.raw);

    const ctx: SsrContext = {
      baseUrl,
      storeName: storeConfig.storeName,
      tagline: storeConfig.tagline,
      heroCopy: storeConfig.heroCopy,
      whatsapp: storeConfig.whatsapp,
      city: storeConfig.city,
      aboutTitle: storeConfig.aboutTitle,
      aboutText: storeConfig.aboutText,
      logo: storeConfig.logo,
      heroImg1: storeConfig.heroImg1,
      heroImg2: storeConfig.heroImg2,
      aboutImg: storeConfig.aboutImg
    };

    const ldJson = generateStructuredData(products, ctx, {
      total: Number(statsRes?.total ?? 0),
      average: Number(Number(statsRes?.average ?? 0).toFixed(2))
    });

    // Inyectamos el JSON-LD justo antes de cerrar el <head> (sin distinguir mayúsculas)
    const injected = /<\/head\s*>/i.test(html)
      ? html.replace(/<\/head\s*>/i, `${ldJson}</head>`)
      : html.replace(/<\/body\s*>/i, `${ldJson}</body>`);

    const headers = new Headers(assetResponse.headers);
    // El HTML cambió de tamaño: eliminamos cabeceras de longitud obsoletas
    headers.delete('content-length');
    headers.delete('etag');
    headers.delete('Content-Length');
    headers.delete('ETag');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return new Response(injected, { status: assetResponse.status, headers });
  } catch (err) {
    // Cualquier fallo en la inyección: servimos el asset original intacto
    console.error('Error inyectando JSON-LD:', err);
    return assetResponse;
  }
});

// 7. Fallback: rutas API devuelven JSON, el resto se sirve desde ASSETS
app.all('*', async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Ruta no encontrada' }, 404);
  }

  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text('Recurso no encontrado', 404);
});

export default app;
