import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, User, Product } from './types';
import { authMiddleware } from './middleware/auth';
import authApp from './routes/auth';
import productsApp from './routes/products';
import ordersApp from './routes/orders';
import couponsApp from './routes/coupons';
import reviewsApp from './routes/reviews';
import aiApp from './routes/ai';
import mediaApp from './routes/media';
import { generateSitemap, generateRobotsTxt, generateStructuredData } from './services/ssr';

const app = new Hono<{ Bindings: Env; Variables: { user?: User } }>();

// 1. Cabeceras de Seguridad y CORS
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
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
    const prodsRes = await c.env.JY_DB.prepare('SELECT id, name, category, price, is_active FROM products WHERE is_active = 1').all<Product>();
    const xml = generateSitemap(prodsRes.results || []);
    return c.text(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  } catch (err) {
    return c.text('Error al generar sitemap', 500);
  }
});

app.get('/robots.txt', (c) => {
  return c.text(generateRobotsTxt(), 200, { 'Content-Type': 'text/plain; charset=utf-8' });
});

// 6. SSR Parcial / Inyección de Catálogo y JSON-LD en la ruta raíz
app.get('/', async (c) => {
  if (c.env.ASSETS) {
    const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
    
    // Si la respuesta es HTML, inyectar JSON-LD de productos y metadata
    const contentType = assetResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      try {
        let html = await assetResponse.text();
        const prodsRes = await c.env.JY_DB.prepare('SELECT * FROM products WHERE is_active = 1 LIMIT 8').all<Product>();
        const products = prodsRes.results || [];
        
        const configRes = await c.env.JY_DB.prepare('SELECT key, value FROM store_config').all<any>();
        const config: Record<string, string> = {};
        (configRes.results || []).forEach(row => {
          config[row.key] = row.value;
        });

        const ldJson = generateStructuredData(products, config);
        html = html.replace('</head>', `${ldJson}</head>`);

        return new Response(html, {
          headers: assetResponse.headers
        });
      } catch (err) {
        // En caso de cualquier detalle en la inyección, servir el asset original intacto
        return assetResponse;
      }
    }
    return assetResponse;
  }
  return c.text('JY Velas y Jabones API en el Edge activa.', 200);
});

// 7. Fallback para archivos estáticos (JS, CSS, imágenes, PWA)
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Recurso no encontrado', 404);
});

export default app;
