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

export type OrderAction = "confirm" | "ready" | "dispatch" | "cancel";

export interface OrderAvailableAction {
  action: OrderAction | string;
  label: string;
}

export interface ApiOrder {
  id: string;
  platform: OrderPlatform;
  platform_order_id: string;
  app_shop_id: string | null;
  order_number?: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: OrderItem[];
  total_price: number;
  created_at: string;
  updated_at: string;
  order_type?: string | null;
  delivery_type?: string | null;
  payment_method?: string | null;
  payment_when?: string | null;
  store_name?: string | null;
  distance_km?: number | null;
  delivery_neighborhood?: string | null;
  delivery_promise?: string | null;
  delivery_promise_at?: string | null;
  promise_time?: string | null;
  neighborhood?: string | null;
  note?: string | null;
  kds_stage?: string | null;
  available_actions?: OrderAvailableAction[];
  courier_name?: string | null;
  pickup_code?: string | null;
  promise_epoch?: number | null;
}