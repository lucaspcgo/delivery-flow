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

const TOKEN_STORAGE_KEY = "dap.auth.token";

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
    if (res.status === 401) authToken.clear();
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
  restaurant_id: string;
  platform: Platform;
  status: IntegrationStatus;
  connected_at: string | null;
  last_sync_at: string | null;
  error_message?: string | null;
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
  list: (restaurantId?: string) =>
    http.get<Integration[]>("/integrations", {
      query: { restaurant_id: restaurantId },
    }),
  connect: (
    restaurantId: string,
    platform: Platform,
    credentials: Record<string, string>,
  ) =>
    http.post<Integration>("/integrations/connect", {
      restaurant_id: restaurantId,
      platform,
      credentials,
    }),
  disconnect: (id: string) =>
    http.post<Integration>(`/integrations/${id}/disconnect`),
};

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

export function formatSaoPaulo(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    ...opts,
  }).format(new Date(iso));
}
