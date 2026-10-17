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
  created_at?: string;
}

export interface CartItem {
  id: number;
  quantity: number;
}

export interface Coupon {
  id: number;
  code: string;
  discount_pct: number;
  active: number;
}

export interface Review {
  id: string;
  name: string;
  text: string;
  stars: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_score?: number;
  flagged_for_admin?: number;
  date: string;
}
