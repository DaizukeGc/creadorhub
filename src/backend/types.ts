export interface Ai {
  run(model: string, input: Record<string, unknown>): Promise<any>;
}

export interface Env {
  JY_DB: D1Database;
  JY_STORAGE?: R2Bucket;
  AI?: Ai;
  JY_VECTOR?: any;
  ASSETS?: Fetcher;
  /** Secreto de firma de las sesiones. Configurar con `wrangler secret put JWT_SECRET`. */
  JWT_SECRET?: string;
  /** URL pública del sitio (usada en sitemap, JSON-LD y Open Graph). */
  PUBLIC_URL?: string;
  /** Origen(es) permitidos para CORS, separados por coma. Por defecto solo el mismo origen. */
  ALLOWED_ORIGINS?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  active: number;
  token_version: number;
  created_at: string;
}

export interface UserWithSecrets extends User {
  password_hash: string;
  password_salt: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  old_price?: number | null;
  stock: number;
  rating: number;
  sold: number;
  badge?: string | null;
  badge_type?: string | null;
  image?: string | null;
  features: string[];
  description: string;
  keywords?: string | null;
  is_active: number;
  is_available?: number;
  display_order: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  display_order: number;
}

export type OrderStatus = 'pendiente' | 'en preparación' | 'enviado' | 'entregado';

export interface Order {
  id: string;
  user_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  customer_notes?: string;
  subtotal: number;
  discount: number;
  total: number;
  coupon_code?: string | null;
  status: OrderStatus;
  created_at: string;
}

export interface OrderItem {
  id?: number;
  order_id: string;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface Coupon {
  id: number;
  code: string;
  discount_pct: number;
  active: number;
  created_at: string;
}

export interface Review {
  id: string;
  name: string;
  text: string;
  stars: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  flagged_for_admin: number;
  date: string;
  created_at: string;
}

export interface StoreConfig {
  storeName: string;
  tagline: string;
  heroCopy: string;
  aboutTitle: string;
  aboutText: string;
  whatsapp: string;
  tiktok: string;
  city: string;
  topMsg: string;
  logo: string;
  heroImg1: string;
  heroImg2: string;
  aboutImg: string;
}

export const ORDER_STATUSES: OrderStatus[] = ['pendiente', 'en preparación', 'enviado', 'entregado'];
