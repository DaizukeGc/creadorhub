export interface Env {
  JY_DB: D1Database;
  JY_STORAGE?: R2Bucket;
  AI?: any;
  JY_VECTOR?: any;
  ASSETS?: Fetcher;
  JWT_SECRET?: string;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  name: string;
  role: 'admin' | 'user';
  active: number;
  created_at: string;
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
  keywords?: string;
  is_active: number;
  display_order: number;
  created_at: string;
}

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
  status: 'pendiente' | 'en preparación' | 'enviado' | 'entregado';
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
