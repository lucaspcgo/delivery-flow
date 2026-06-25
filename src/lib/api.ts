import { toast } from "sonner";

/**
 * Camada de serviço HTTP para a API REST externa do Delivery Auto Pro.
 *
 * IMPORTANTE: este projeto NÃO usa Supabase. Todos os dados vêm de
 * https://api.deliveryautopro.com.br/api/v1 (configurável via VITE_API_URL).
 */

export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://api.deliveryautopro.com.br/api/v1";

const TOKEN_STORAGE_KEY = "auth_token";
const USER_STORAGE_KEY = "auth_user";

export const authToken = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  silent?: boolean;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, silent } = opts;

  const url = new URL(
    path.startsWith("http")
      ? path
      : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = authToken.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha de rede ao contatar a API";
    if (!silent) toast.error("Erro de conexão", { description: message });
    throw new ApiError(message, 0, null);
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `Erro ${res.status} ao chamar ${path}`;
    if (!silent) toast.error("Erro na requisição", { description: message });
    if (res.status === 401) {
      authToken.clear();
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.location.href = "/login";
      }
    }
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

export const http = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};

// ---------- Tipos do domínio ----------

export type Platform = "ifood" | "99food" | "keeta";
export type IntegrationStatus = "connected" | "disconnected" | "error";
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "dispatched"
  | "delivered"
  | "cancelled";

export interface Restaurant {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  active: boolean;
  created_at: string;
}

export interface Integration {
  id: string;
  platform: Platform;
  name: string;
  description: string;
  status: IntegrationStatus;
  orders_count: number;
  last_sync_at: string | null;
  api_status: "online" | "offline";
}

export interface Order {
  id: string;
  restaurant_id: string;
  platform: Platform;
  external_id: string;
  number: string;
  status: OrderStatus;
  customer_name: string;
  total: number;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface Automation {
  id: string;
  restaurant_id: string;
  name: string;
  auto_accept: boolean;
  ready_after_minutes: number | null;
  platforms: Platform[];
  active_hours?: { from: string; to: string } | null;
  enabled: boolean;
}

export interface ReportSummary {
  orders_per_day: { date: string; count: number }[];
  avg_prep_time_minutes: number;
  avg_ticket: number;
  revenue: number;
  cancellations: number;
}

// ---------- Auth ----------

export const auth = {
  async login(email: string, password: string) {
    const data = await http.post<{
      token: string;
      user: { id: string; email: string };
    }>("/auth/login", { email, password });
    authToken.set(data.token);
    return data;
  },
  logout() {
    authToken.clear();
  },
  me: () => http.get<{ id: string; email: string; name: string }>("/auth/me"),
};

// ---------- Recursos ----------

export const restaurantsApi = {
  list: () => http.get<Restaurant[]>("/restaurants"),
  get: (id: string) => http.get<Restaurant>(`/restaurants/${id}`),
  create: (data: Omit<Restaurant, "id" | "created_at">) =>
    http.post<Restaurant>("/restaurants", data),
  update: (id: string, data: Partial<Restaurant>) =>
    http.put<Restaurant>(`/restaurants/${id}`, data),
  remove: (id: string) => http.delete<void>(`/restaurants/${id}`),
};

export const integrationsApi = {
  list: () => http.get<Integration[]>("/integrations"),
  connect: (platform: Platform) =>
    http.post<Integration>(`/integrations/${platform}/connect`),
  disconnect: (platform: Platform) =>
    http.post<Integration>(`/integrations/${platform}/disconnect`),
};

export const getIntegrations = () => integrationsApi.list();
export const connectIntegration = (platform: Platform) =>
  integrationsApi.connect(platform);
export const disconnectIntegration = (platform: Platform) =>
  integrationsApi.disconnect(platform);

export const ordersApi = {
  list: (params?: {
    restaurant_id?: string;
    status?: OrderStatus;
    platform?: Platform;
    from?: string;
    to?: string;
    search?: string;
  }) => http.get<Order[]>("/orders", { query: params }),
  get: (id: string) => http.get<Order>(`/orders/${id}`),
  accept: (id: string) => http.post<Order>(`/orders/${id}/accept`),
  startPreparation: (id: string) =>
    http.post<Order>(`/orders/${id}/start-preparation`),
  markReady: (id: string) => http.post<Order>(`/orders/${id}/ready`),
  cancel: (id: string, reason?: string) =>
    http.post<Order>(`/orders/${id}/cancel`, { reason }),
};

// ---------- Pedidos reais vindos da API externa ----------

import type { ApiOrder, OrderPlatform } from "@/types/order";

function normalizeOrder(raw: ApiOrder): ApiOrder {
  return {
    ...raw,
    total_price:
      typeof raw.total_price === "string"
        ? Number(raw.total_price)
        : raw.total_price ?? 0,
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

export async function getOrders(
  platform?: string,
  date?: string,
): Promise<ApiOrder[]> {
  const p = platform && platform !== "all" ? platform : "99food";
  const data = await http.get<ApiOrder[]>(`/orders/${p}/orders`, {
    silent: true,
    query: date ? { date } : undefined,
  });
  return (Array.isArray(data) ? data : []).map(normalizeOrder);
}

export async function confirmOrder(
  platformOrderId: string,
  appShopId: string,
  platform: OrderPlatform = "99food",
): Promise<{ success: true }> {
  if (platform === "ifood") {
    await http.post(`/orders/ifood/${platformOrderId}/confirm`, {});
  } else {
    await http.post(`/orders/${platform}/${platformOrderId}/confirm`, {
      app_shop_id: appShopId,
    });
  }
  return { success: true };
}

export async function cancelOrder(
  platformOrderId: string,
  appShopId: string,
  platform: OrderPlatform = "99food",
): Promise<{ success: true }> {
  if (platform === "ifood") {
    await http.post(`/orders/ifood/${platformOrderId}/cancel`, {
      reason: "INTERNAL_DIFFICULTIES",
    });
  } else {
    await http.post(`/orders/${platform}/${platformOrderId}/cancel`, {
      app_shop_id: appShopId,
      cancel_code: 1040,
    });
  }
  return { success: true };
}

export async function readyOrder(
  platform: string,
  orderId: string,
): Promise<{ success: true }> {
  await http.post(`/orders/${platform}/${orderId}/ready`, {});
  return { success: true };
}

export async function getAllOrders(
  platforms: OrderPlatform[] = ["99food", "ifood"],
  date?: string,
): Promise<ApiOrder[]> {
  const results = await Promise.allSettled(
    platforms.map((p) => getOrders(p, date)),
  );
  const merged = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );
  merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return merged;
}

export const automationsApi = {
  list: (restaurantId?: string) =>
    http.get<Automation[]>("/automations", {
      query: { restaurant_id: restaurantId },
    }),
  create: (data: Omit<Automation, "id">) =>
    http.post<Automation>("/automations", data),
  update: (id: string, data: Partial<Automation>) =>
    http.put<Automation>(`/automations/${id}`, data),
  remove: (id: string) => http.delete<void>(`/automations/${id}`),
};

export const reportsApi = {
  summary: (params?: { restaurant_id?: string; from?: string; to?: string }) =>
    http.get<ReportSummary>("/reports/summary", { query: params }),
};

// ---------- Dashboard ----------

export interface DashboardSummary {
  pedidos_hoje: number;
  var_pedidos: number;
  pendentes: number;
  cancelados: number;
  var_cancelados: number;
  ticket_medio: number;
  faturamento: number;
  var_faturamento: number;
  ultimos_7_dias: { dia: string; faturamento: number; pedidos: number }[];
  por_plataforma: { platform: string; total: number }[];
}

export async function getDashboardSummary(params?: {
  date?: string;
  platform?: string;
}): Promise<DashboardSummary> {
  const query: Record<string, string> = {};
  if (params?.date) query.date = params.date;
  if (params?.platform && params.platform !== "all")
    query.platform = params.platform;
  // Debug temporário: ver URL final chamada
  console.log("[dashboard/summary] query:", query);
  const data = await http.get<Partial<DashboardSummary>>("/dashboard/summary", {
    silent: true,
    query,
  });
  return {
    pedidos_hoje: Number(data.pedidos_hoje ?? 0),
    var_pedidos: Number(data.var_pedidos ?? 0),
    pendentes: Number(data.pendentes ?? 0),
    cancelados: Number(data.cancelados ?? 0),
    var_cancelados: Number(data.var_cancelados ?? 0),
    ticket_medio: Number(data.ticket_medio ?? 0),
    faturamento: Number(data.faturamento ?? 0),
    var_faturamento: Number(data.var_faturamento ?? 0),
    ultimos_7_dias: Array.isArray(data.ultimos_7_dias) ? data.ultimos_7_dias : [],
    por_plataforma: Array.isArray(data.por_plataforma) ? data.por_plataforma : [],
  };
}

// ---------- Automações ----------

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  platform: "ifood" | "99food" | "keeta" | "all" | string;
  enabled: boolean;
  delay_seconds: number;
}

export async function getAutomations(): Promise<AutomationRule[]> {
  const data = await http.get<AutomationRule[]>("/automations", { silent: true });
  return Array.isArray(data) ? data : [];
}

export async function updateAutomation(
  id: string,
  data: Partial<Pick<AutomationRule, "enabled" | "delay_seconds">>,
): Promise<AutomationRule> {
  return http.put<AutomationRule>(`/automations/${id}`, data, { silent: true });
}

// ---------- Restaurantes (API real) ----------

export type RestaurantPlatformCode = "ifood" | "99food" | "keeta";

export interface RestaurantPlatform {
  platform: RestaurantPlatformCode | string;
  status: string; // "authorized" quando conectado
  platform_store_id?: string | null;
  platform_merchant_id?: string | null;
  app_shop_id?: string | null;
}

export interface ApiRestaurant {
  id: string;
  name: string;
  responsible_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  platforms?: RestaurantPlatform[];
  created_at?: string;
  updated_at?: string;
}

export type RestaurantInput = Partial<
  Pick<ApiRestaurant, "name" | "responsible_name" | "phone" | "email" | "address">
>;

export interface ConnectPlatformInput {
  platform: RestaurantPlatformCode | string;
  platform_store_id?: string;
  platform_merchant_id?: string;
  app_shop_id?: string;
}

export async function getRestaurants(): Promise<ApiRestaurant[]> {
  const data = await http.get<ApiRestaurant[]>("/restaurants", { silent: true });
  return Array.isArray(data) ? data : [];
}

export function getRestaurant(id: string): Promise<ApiRestaurant> {
  return http.get<ApiRestaurant>(`/restaurants/${id}`, { silent: true });
}

export function createRestaurant(data: RestaurantInput): Promise<ApiRestaurant> {
  return http.post<ApiRestaurant>("/restaurants", data);
}

export function updateRestaurant(
  id: string,
  data: RestaurantInput,
): Promise<ApiRestaurant> {
  return http.put<ApiRestaurant>(`/restaurants/${id}`, data);
}

export function deleteRestaurant(id: string): Promise<void> {
  return http.delete<void>(`/restaurants/${id}`);
}

export function connectPlatform(
  restaurantId: string,
  data: ConnectPlatformInput,
): Promise<RestaurantPlatform> {
  return http.post<RestaurantPlatform>(
    `/restaurants/${restaurantId}/platforms`,
    data,
  );
}

export function disconnectPlatform(
  restaurantId: string,
  platform: string,
): Promise<void> {
  return http.delete<void>(
    `/restaurants/${restaurantId}/platforms/${platform}`,
  );
}

export function formatSaoPaulo(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...opts,
  }).format(new Date(iso));
}
