export type OrderPlatform = "ifood" | "99food" | "keeta";

export interface OrderSubItem {
  name: string;
  total_price: number;
  amount?: number;
  sub_item_list?: OrderSubItem[];
}

export interface OrderItem {
  name: string;
  amount: number;
  total_price: number;
  image?: string | null;
  sub_item_list?: OrderSubItem[];
}

export interface ApiOrder {
  id: string;
  platform: OrderPlatform;
  platform_order_id: string;
  app_shop_id: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: OrderItem[];
  total_price: number;
  created_at: string;
  updated_at: string;
}