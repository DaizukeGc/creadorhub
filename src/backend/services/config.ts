// Configuración central de la tienda (tabla store_config) y ajustes del Worker.
import { Env, StoreConfig } from '../types';

export const DEFAULT_CONFIG: StoreConfig = {
  storeName: 'JY Velas y Jabones',
  tagline: 'Arte y Esencia en Cada Pieza',
  heroCopy:
    'Jabones botánicos, velas aromáticas en cera de soya y detalles artesanales con acabados elegantes.',
  aboutTitle: 'Belleza artesanal con carácter natural',
  aboutText:
    'JY nace en Neiva del amor por el detalle: piezas hechas a mano, colores intensos, aromas equilibrados.',
  whatsapp: '573150921542',
  tiktok: 'velas_y_jabones_jy',
  city: 'Neiva, Colombia',
  topMsg: '✨ Envío gratis desde $60.000 · Gira la ruleta y gana descuentos exclusivos',
  logo: '/assets/jy/logo.svg',
  heroImg1: '/assets/jy/hero-1.svg',
  heroImg2: '/assets/jy/hero-2.svg',
  aboutImg: '/assets/jy/coleccion-artesanal.svg'
};

const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof StoreConfig)[];

/** Lee la configuración pública de la tienda desde D1. */
export async function getStoreConfig(env: Env): Promise<StoreConfig> {
  const config: StoreConfig = { ...DEFAULT_CONFIG };
  try {
    const res = await env.JY_DB.prepare('SELECT key, value FROM store_config').all<{
      key: string;
      value: string;
    }>();
    for (const row of res.results || []) {
      if ((CONFIG_KEYS as string[]).includes(row.key)) {
        config[row.key as keyof StoreConfig] = row.value;
      }
    }
  } catch (err) {
    console.error('Error al leer store_config:', err);
  }
  return config;
}

/** URL pública del sitio (para sitemap, JSON-LD y enlaces sociales). */
export function getPublicUrl(env: Env, request?: Request): string {
  const configured = env.PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      /* ignore */
    }
  }
  return 'https://jyvelasyjabones.com';
}

/** Número de WhatsApp en formato internacional sin signos (solo dígitos). */
export function normalizeWhatsapp(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Enlace wa.me listo para usar. */
export function whatsappLink(number: string, text?: string): string {
  const digits = normalizeWhatsapp(number);
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
