// Servicio de Server-Side Rendering (SSR) y SEO Técnico para Cloudflare Workers
import { Product } from '../types';

export interface SsrContext {
  baseUrl: string;
  storeName: string;
  tagline: string;
  heroCopy: string;
  whatsapp: string;
  city: string;
  aboutTitle: string;
  aboutText: string;
  logo: string;
  heroImg1: string;
  heroImg2: string;
  aboutImg: string;
}

export interface ReviewStats {
  total: number;
  average: number;
}

export function generateStructuredData(
  products: Product[],
  ctx: SsrContext,
  stats: ReviewStats
): string {
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: ctx.storeName,
    slogan: ctx.tagline,
    description: ctx.heroCopy,
    url: ctx.baseUrl,
    image: `${ctx.baseUrl}${ctx.heroImg1}`,
    logo: `${ctx.baseUrl}${ctx.logo}`,
    telephone: `+${ctx.whatsapp}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: ctx.city,
      addressCountry: 'CO'
    },
    priceRange: '$$',
    sameAs: [],
    ...(stats.total > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(stats.average || 5),
            reviewCount: String(stats.total),
            bestRating: '5',
            worstRating: '1'
          }
        }
      : {})
  };

  const productSchemas = products.slice(0, 12).map(p => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: p.image ? `${ctx.baseUrl}${p.image}` : `${ctx.baseUrl}${ctx.heroImg1}`,
    description: p.description,
    category: p.category,
    sku: `JY-${p.id}`,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'COP',
      price: p.price,
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${ctx.baseUrl}/#producto-${p.id}`
    }
  }));

  return [
    `<script type="application/ld+json">${JSON.stringify(localBusinessSchema)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(productSchemas)}</script>`
  ].join('\n');
}

export function generateSitemap(products: Product[], baseUrl: string): string {
  const now = new Date().toISOString().slice(0, 10);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/#catalogo</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/#velas</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/#jabones</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/#nosotros</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/#contacto</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;

  for (const p of products) {
    xml += `  <url>
    <loc>${baseUrl}/#producto-${p.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

export function generateRobotsTxt(baseUrl: string): string {
  return `User-agent: *
Allow: /

# Panel privado de administración
Disallow: /portal-jy
Disallow: /portal.html
Disallow: /api/*/admin/
Disallow: /api/auth/

Sitemap: ${baseUrl}/sitemap.xml
`;
}
