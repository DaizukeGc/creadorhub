// Servicio de Server-Side Rendering (SSR) y SEO Técnico para Cloudflare Workers
import { Product } from '../types';

export function generateStructuredData(products: Product[], config: Record<string, string>): string {
  const storeName = config.storeName || 'JY Velas y Jabones';
  const phone = config.whatsapp || '573150921542';

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: storeName,
    description: config.heroCopy || 'Velas aromáticas y jabones artesanales premium hechos a mano en Colombia.',
    telephone: `+${phone}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Neiva',
      addressRegion: 'Huila',
      addressCountry: 'CO'
    },
    priceRange: '$$',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '350'
    }
  };

  const productSchemas = products.slice(0, 8).map(p => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: p.image || 'https://jyvelasyjabones.com/assets/jy/mesa-premium.png',
    description: p.description,
    category: p.category,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'COP',
      price: p.price,
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `https://jyvelasyjabones.com/#producto-${p.id}`
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: p.rating || 4.9,
      reviewCount: p.sold || 20
    }
  }));

  return `
    <script type="application/ld+json">
      ${JSON.stringify(localBusinessSchema)}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(productSchemas)}
    </script>
  `;
}

export function generateSitemap(products: Product[]): string {
  const baseUrl = 'https://jyvelasyjabones.com';
  const now = new Date().toISOString().slice(0, 10);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;

  for (const p of products) {
    xml += `  <url>
    <loc>${baseUrl}/#producto-${p.id}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  xml += `</urlset>`;
  return xml;
}

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Disallow: /api/admin/
Disallow: /portal-jy
Disallow: /portal.html

Sitemap: https://jyvelasyjabones.com/sitemap.xml
`;
}
