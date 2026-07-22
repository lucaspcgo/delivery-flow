import { toast } from "sonner";

/**
 * Camada de serviço HTTP para a API REST externa do Zero Tempo.
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
    try {
      return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (err) {
      console.warn("[authToken] falha ao salvar token no localStorage", err);
    }
  },
  clear() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Persiste com segurança um objeto no localStorage. Retorna false em modo
 * privado / storage cheio / CSP restritiva.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[storage] falha ao salvar ${key}`, err);
    return false;
  }
}

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
    // Bloqueio de acesso: aplica-se a qualquer chamada autenticada
    const p = (payload ?? {}) as Record<string, unknown>;
    const accessBlocked = res.status === 403 && p.access_blocked === true;
    const trialExpired =
      res.status === 403 && (p.trial_expired === true || p.code === "trial_expired");
    const paymentSuspended =
      res.status === 403 &&
      (p.payment_suspended === true || p.code === "payment_suspended");
    const anyBlocked = accessBlocked || trialExpired || paymentSuspended;
    if (!silent && !anyBlocked) {
      toast.error("Erro na requisição", { description: message });
    }
    // Plan gating: emit event for centralized modal
    if (res.status === 403 && typeof window !== "undefined") {
      const errCode = (p.error as string | undefined) ?? (p.code as string | undefined);
      const known = new Set([
        "plan_upgrade_required",
        "plan_limit_reached",
        "account_inactive",
        "trial_expired",
      ]);
      if (!anyBlocked && errCode && known.has(errCode)) {
        window.dispatchEvent(
          new CustomEvent("plan-gate", { detail: { ...p, error: errCode } }),
        );
      }
    }
    if (anyBlocked) {
      authToken.clear();
      if (typeof window !== "undefined" && window.location.pathname !== "/blocked") {
        const errMsg =
          (typeof p.error === "string" && p.error) ||
          (typeof p.message === "string" && p.message) ||
          (trialExpired
            ? "Seu período gratuito expirou."
            : paymentSuspended
              ? "Acesso suspenso. Regularize seu pagamento."
              : "Acesso bloqueado.");
        const redirectTo =
          (typeof p.redirect === "string" && p.redirect) || "/checkout";
        const reason = accessBlocked
          ? "access_blocked"
          : trialExpired
            ? "trial_expired"
            : "payment_suspended";
        const qs = new URLSearchParams({
          message: errMsg,
          redirect: redirectTo,
          reason,
        });
        window.location.href = `/blocked?${qs.toString()}`;
      }
    } else if (res.status === 401) {
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
    }>("/auth/login", { email, password }, { silent: true });
    authToken.set(data.token);
    return data;
  },
  logout() {
    authToken.clear();
  },
  me: () => http.get<MeResponse>("/auth/me", { silent: true }),
};

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  plan?: string;
  role?: string;
  roles?: string[];
  trial_days_left?: number;
  trial_expired?: boolean;
  payment_suspended?: boolean;
  is_admin?: boolean;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function hasTruthyAdminFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function hasAdminRole(value: unknown): boolean {
  if (typeof value === "string") return value.trim().toLowerCase() === "admin";
  if (!Array.isArray(value)) return false;

  return value.some((item) => hasAdminRole(item));
}

export function hasAdminAccess(me: unknown): boolean {
  if (!isRecord(me)) return false;

  if (hasTruthyAdminFlag(me.is_admin) || hasTruthyAdminFlag(me.isAdmin)) return true;
  if (hasTruthyAdminFlag(me.admin)) return true;
  if (hasAdminRole(me.role) || hasAdminRole(me.roles)) return true;

  return hasAdminAccess(me.user) || hasAdminAccess(me.data);
}

export function getStoredUser(): MeResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as unknown as MeResponse) : null;
  } catch {
    return null;
  }
}

export function getStoredTokenClaims(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;

  try {
    const token = authToken.get();
    const payload = token?.split(".")[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const parsed: unknown = JSON.parse(window.atob(padded));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasStoredAdminAccess(): boolean {
  return hasAdminAccess(getStoredUser()) || hasAdminAccess(getStoredTokenClaims());
}

// Cache em módulo para evitar refetch em todo lugar
let _meCache: MeResponse | null = null;
let _mePromise: Promise<MeResponse> | null = null;

export function getMeCached(force = false): Promise<MeResponse> {
  if (!force && _meCache) return Promise.resolve(_meCache);
  if (!_mePromise) {
    _mePromise = auth
      .me()
      .then((r) => {
        _meCache = r;
        _mePromise = null;
        return r;
      })
      .catch((e) => {
        _mePromise = null;
        throw e;
      });
  }
  return _mePromise;
}

export function clearMeCache() {
  _meCache = null;
  _mePromise = null;
}

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

// ---------- iFood authorization (device code flow) ----------

export interface IfoodAuthStart {
  userCode: string;
  verificationUrl: string;
  verificationUrlComplete: string;
  expiresIn: number;
}

export interface IfoodAuthComplete {
  success: boolean;
  connected?: Array<{ id: string; name: string }>;
  pending?: boolean;
  message?: string;
  stores_count?: number;
  accounts?: number;
}

export interface IfoodAuthStatus {
  authorized: boolean;
  accounts?: number;
  stores_count?: number;
}

export const ifoodAuth = {
  start: () =>
    http.post<IfoodAuthStart>("/integrations/ifood/authorize/start", {}, { silent: true }),
  complete: (authorizationCode: string) =>
    http.post<IfoodAuthComplete>(
      "/integrations/ifood/authorize/complete",
      { authorizationCode },
      { silent: true },
    ),
  status: () =>
    http.get<IfoodAuthStatus>("/integrations/ifood/authorize/status", { silent: true }),
  stores: () =>
    http.get<
      Array<{
        restaurant_id: string;
        name: string;
        merchant_id?: string | null;
        status: string;
        automation_enabled?: boolean;
      }>
    >("/integrations/ifood/stores", { silent: true }),
};

// ---------- 99Food connect shop ----------

export interface NineNineFoodConnectResponse {
  success: boolean;
  connected?: Array<{ id: string; name: string }>;
  name?: string;
}

export const nineNineFoodApi = {
  authorizeUrl: () =>
    http.get<{ url: string }>("/integrations/99food/authorize-url", { silent: true }),
  connectShop: (appShopId: string, name?: string) =>
    http.post<NineNineFoodConnectResponse>(
      "/integrations/99food/connect-shop",
      { app_shop_id: appShopId, name },
      { silent: true },
    ),
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
  includeFinished: boolean = true,
): Promise<ApiOrder[]> {
  const p = platform && platform !== "all" ? platform : "99food";
  const query: Record<string, string | number> = {};
  if (date) query.date = date;
  if (includeFinished) query.include_finished = 1;
  const data = await http.get<ApiOrder[]>(`/orders/${p}/orders`, {
    silent: true,
    query: Object.keys(query).length ? query : undefined,
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
): Promise<{ success: true; platform_synced?: boolean; warning?: string | null }> {
  const res = await http.post<{ platform_synced?: boolean; warning?: string | null } | null>(
    `/orders/${platform}/${orderId}/ready`,
    {},
  );
  return {
    success: true,
    platform_synced: res?.platform_synced,
    warning: res?.warning ?? null,
  };
}

export async function dispatchOrder(
  platform: string,
  orderId: string,
): Promise<{ success: true }> {
  await http.post(`/orders/${platform}/${orderId}/dispatch`, {});
  return { success: true };
}

export interface OrderStagePatch {
  platform_order_id: string;
  status: string;
  kds_stage: string;
  available_actions: { action: string; label: string }[];
}

export type RunOrderActionResult =
  | {
      ok: true;
      order: OrderStagePatch;
      platform_synced?: boolean;
      warning?: string | null;
    }
  | { ok: false; error: string; details?: string; status: number };

export async function runOrderAction(
  platform: string,
  platformOrderId: string,
  action: string,
): Promise<RunOrderActionResult> {
  const url = `${API_URL}/orders/${platform}/${platformOrderId}/${action}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = authToken.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: "{}" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha de rede";
    return { ok: false, error: message, status: 0 };
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const d = (data ?? {}) as { error?: unknown; details?: unknown };
    return {
      ok: false,
      error: typeof d.error === "string" ? d.error : `Erro ${res.status}`,
      details: typeof d.details === "string" ? d.details : undefined,
      status: res.status,
    };
  }

  const ok = (data ?? {}) as {
    order?: OrderStagePatch;
    platform_synced?: boolean;
    warning?: string | null;
  };
  if (!ok.order) {
    return { ok: false, error: "Resposta inválida do servidor", status: res.status };
  }
  return {
    ok: true,
    order: ok.order,
    platform_synced: ok.platform_synced,
    warning: ok.warning ?? null,
  };
}

export async function reprocess99FoodPending(): Promise<{
  processed: number;
  raw: Record<string, unknown>;
}> {
  const res = await http.post<Record<string, unknown> | null>(
    "/orders/99food/reprocess-pending",
    {},
    { silent: true },
  );
  const data = (res ?? {}) as Record<string, unknown>;
  const candidates = [
    data.processed,
    data.count,
    data.reprocessed,
    (data.orders as unknown[] | undefined)?.length,
  ];
  const processed = candidates.find((v) => typeof v === "number") as number | undefined;
  return { processed: processed ?? 0, raw: data };
}

export async function getAllOrders(
  platforms: OrderPlatform[] = ["99food", "ifood"],
  date?: string,
  includeFinished: boolean = true,
): Promise<ApiOrder[]> {
  const results = await Promise.allSettled(
    platforms.map((p) => getOrders(p, date, includeFinished)),
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
  accept_delay_seconds: number;
}

export async function getAutomations(): Promise<AutomationRule[]> {
  const data = await http.get<AutomationRule[]>("/automations", { silent: true });
  return Array.isArray(data) ? data : [];
}

export async function updateAutomation(
  id: string,
  data: Partial<
    Pick<AutomationRule, "enabled" | "delay_seconds" | "accept_delay_seconds">
  >,
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
  automation_enabled?: boolean;
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

export interface SetAutomationInput {
  platform: RestaurantPlatformCode | string;
  store_id: string;
  enabled: boolean;
}

export interface SetAutomationResponse {
  platform: string;
  store_id: string;
  automation_enabled: boolean;
}

export function setPlatformAutomation(
  data: SetAutomationInput,
): Promise<SetAutomationResponse> {
  return http.put<SetAutomationResponse>("/restaurants/automation", data, {
    silent: true,
  });
}

export interface AuthorizeStoreResponse {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  responsible_name?: string;
  platform_store_id?: string;
  platform_merchant_id?: string;
  app_shop_id?: string;
  [key: string]: unknown;
}

export function authorizeStore(
  platform: RestaurantPlatformCode | string,
  platform_id: string,
): Promise<AuthorizeStoreResponse> {
  return http.post<AuthorizeStoreResponse>("/restaurants/authorize", {
    platform,
    platform_id,
  });
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

// ---------- Relatórios ----------

export interface ReportsSummary {
  resumo: {
    total_pedidos: number;
    faturamento_total: number;
    ticket_medio: number;
    taxa_aceite: number;
    aceitos: number;
    cancelados: number;
    taxa_cancelamento: number;
  };
  por_dia: { dia: string; faturamento: number; pedidos: number }[];
  por_hora: { hora: number; pedidos: number }[];
  por_plataforma: {
    platform: string;
    pedidos: number;
    faturamento: number;
    ticket_medio: number;
  }[];
  top_itens: { nome: string; quantidade: number; valor_total: number }[];
  por_restaurante: {
    restaurante: string;
    platform: string;
    usuario?: string | null;
    pedidos: number;
    faturamento: number;
  }[];
  por_status: { status: string; total: number }[];
}

// ---------- Configurações (Perfil/Empresa/Plano/Segurança/2FA) ----------

export type UserPlan = "starter" | "pro" | "enterprise";

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  company_cnpj: string;
  company_address: string;
  plan: UserPlan;
  totp_enabled: boolean;
}

export function getProfile(): Promise<UserProfile> {
  return http.get<UserProfile>("/settings/profile", { silent: true });
}

export function updateProfile(
  data: Pick<UserProfile, "name" | "email" | "phone">,
): Promise<UserProfile> {
  return http.put<UserProfile>("/settings/profile", data);
}

export function updateCompany(
  data: Pick<UserProfile, "company_name" | "company_cnpj" | "company_address">,
): Promise<UserProfile> {
  return http.put<UserProfile>("/settings/company", data);
}

export function updatePlan(plan: UserPlan): Promise<UserProfile> {
  return http.put<UserProfile>("/settings/plan", { plan }, { silent: true });
}

export function changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<{ success: true }> {
  return http.put<{ success: true }>("/settings/password", data);
}

export interface TwoFactorSetup {
  otpauth_url: string;
  secret?: string;
}

export function setup2FA(): Promise<TwoFactorSetup> {
  return http.post<TwoFactorSetup>("/settings/2fa/setup");
}

export function verify2FA(code: string): Promise<{ success: true }> {
  return http.post<{ success: true }>("/settings/2fa/verify", { code });
}

export function disable2FA(): Promise<{ success: true }> {
  return http.post<{ success: true }>("/settings/2fa/disable");
}

// ---------- Admin ----------

export interface AdminStats {
  total_users: number;
  active_users: number;
  revenue_total: number;
  invoices_pending: number;
  total_restaurants: number;
  total_orders: number;
  gmv: number;
  users_by_plan: { plan: UserPlan; total: number }[];
}

export type PaymentStatus = "active" | "pending" | "suspended" | "cancelled";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: UserPlan;
  payment_status: PaymentStatus;
  is_admin: boolean;
  active: boolean;
  created_at?: string;
  phone?: string;
  plan_expires_at?: string | null;
}

export interface AdminInvoice {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  plan: UserPlan;
  amount: number;
  status: "pending" | "paid" | "failed";
  due_date: string;
  paid_at?: string | null;
}

export interface AdminSetting {
  key: string;
  value: string;
}

export const getAdminStats = () =>
  http.get<AdminStats>("/admin/stats", { silent: true });

export const getAdminUsers = () =>
  http.get<AdminUser[]>("/admin/users", { silent: true });

export const getAdminUser = (id: string) =>
  http.get<AdminUser & { invoices?: AdminInvoice[] }>(`/admin/users/${id}`, {
    silent: true,
  });

export const updateAdminUser = (id: string, data: Partial<AdminUser>) =>
  http.put<AdminUser>(`/admin/users/${id}`, data);

export const createAdminUser = (data: {
  name: string;
  email: string;
  password: string;
  plan: UserPlan;
  is_admin?: boolean;
}) => http.post<AdminUser>("/admin/users", data);

export const deleteAdminUser = (id: string) =>
  http.delete<void>(`/admin/users/${id}`);

export const getAdminInvoices = (filters?: {
  status?: string;
  email?: string;
}) =>
  http.get<AdminInvoice[]>("/admin/invoices", {
    silent: true,
    query: filters,
  });

export const createAdminInvoice = (data: {
  user_id: string;
  plan: UserPlan;
  amount: number;
  due_date: string;
}) => http.post<AdminInvoice>("/admin/invoices", data);

export const updateAdminInvoice = (id: string, data: Partial<AdminInvoice>) =>
  http.put<AdminInvoice>(`/admin/invoices/${id}`, data);

export const getAdminSettings = () =>
  http.get<AdminSetting[]>("/admin/settings", { silent: true });

export const updateAdminSetting = (key: string, value: string) =>
  http.put<AdminSetting>(`/admin/settings/${key}`, { value });

// ---------- Checkout (público) ----------

export interface CheckoutPlan {
  id: string;
  key: "starter" | "pro" | "enterprise";
  name: string;
  price: number | null;
  price_label?: string;
  features: string[];
  highlighted?: boolean;
  cta?: string;
}

export interface CheckoutCreateInput {
  plan: string;
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

export interface CheckoutCreateResponse {
  invoice_id: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  amount?: number;
  expires_at?: string;
  type?: "paid" | "free_trial";
  token?: string;
  user?: { id: string; name: string; email: string; is_admin?: boolean };
}

export interface CheckoutConfirmResponse {
  status: "paid" | "pending" | "failed";
  token?: string;
  user?: { id: string; name: string; email: string; is_admin?: boolean };
}

export const getPlans = () =>
  http.get<CheckoutPlan[]>("/checkout/plans", { silent: true });

export const createCheckout = (data: CheckoutCreateInput) =>
  http.post<CheckoutCreateResponse>("/checkout/create", data, { silent: true });

export const confirmPayment = (data: { invoice_id: string }) =>
  http.post<CheckoutConfirmResponse>("/checkout/confirm", data, { silent: true });

export const getPaymentStatus = (invoiceId: string) =>
  http.get<CheckoutConfirmResponse>(`/checkout/status/${invoiceId}`, {
    silent: true,
  });

// ---------- Planos (DB) ----------

export type PlanPeriod =
  | "weekly"
  | "monthly"
  | "yearly"
  | "annual"
  | "one_time"
  | "free";

export const PLAN_PERIOD_LABEL: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
  annual: "Anual",
  one_time: "Único",
  free: "Gratuito",
};

const PLAN_PERIOD_SUFFIX: Record<string, string> = {
  weekly: "/semana",
  monthly: "/mês",
  yearly: "/ano",
  annual: "/ano",
  one_time: " (único)",
  free: "",
};

export function formatPlanPrice(plan: {
  price: number;
  period?: string;
  is_free?: boolean;
  billing_period?: string;
}): string {
  const period = (plan.billing_period ?? plan.period ?? "") as string;
  if (plan.is_free || period === "free") return "Grátis";
  if (!plan.price || plan.price <= 0) return "Sob consulta";
  const value = `R$ ${Number(plan.price).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  })}`;
  const suffix = PLAN_PERIOD_SUFFIX[period] ?? "";
  return `${value}${suffix}`;
}

export interface DBPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  period: PlanPeriod;
  billing_period?: string;
  features: string[];
  popular: boolean;
  is_free: boolean;
  active: boolean;
  menu_sync?: boolean;
  auto_accept?: boolean;
  max_restaurants: number;
  max_orders_per_month: number;
  display_order: number;
}

export type DBPlanInput = Partial<Omit<DBPlan, "id">>;

export const getPlansPublic = () =>
  http.get<DBPlan[]>("/plans", { silent: true });

export const getPlansAdmin = () =>
  http.get<DBPlan[]>("/plans/all", { silent: true });

export const createPlan = (data: DBPlanInput) =>
  http.post<DBPlan>("/plans", data);

export const updatePlanDB = (id: string, data: DBPlanInput) =>
  http.put<DBPlan>(`/plans/${id}`, data);

export const deletePlan = (id: string) =>
  http.delete<void>(`/plans/${id}`);

// ---------- Usage / plan gating ----------

export interface UsageResponse {
  plan: string;
  plan_name?: string;
  capabilities: { menu_sync: boolean; auto_accept: boolean };
  restaurants_count: number;
  max_restaurants: number;
  orders_this_month: number;
  max_orders_month: number;
  over_limit: boolean;
  next_tier?: string | null;
}

export const getUsage = () =>
  http.get<UsageResponse>("/usage", { silent: true });


// ---------- Relatórios ----------

export async function getReports(params: {
  start_date: string;
  end_date: string;
  platform?: string;
  restaurant_id?: string;
  user_id?: string;
}): Promise<ReportsSummary> {
  const query: Record<string, string> = {
    start_date: params.start_date,
    end_date: params.end_date,
  };
  if (params.platform && params.platform !== "all")
    query.platform = params.platform;
  if (params.restaurant_id && params.restaurant_id !== "all")
    query.restaurant_id = params.restaurant_id;
  if (params.user_id && params.user_id !== "all")
    query.user_id = params.user_id;
  const data = await http.get<Partial<ReportsSummary>>("/reports/summary", {
    silent: true,
    query,
  });
  const r = (data?.resumo ?? {}) as Partial<ReportsSummary["resumo"]>;
  return {
    resumo: {
      total_pedidos: Number(r.total_pedidos ?? 0),
      faturamento_total: Number(r.faturamento_total ?? 0),
      ticket_medio: Number(r.ticket_medio ?? 0),
      taxa_aceite: Number(r.taxa_aceite ?? 0),
      aceitos: Number(r.aceitos ?? 0),
      cancelados: Number(r.cancelados ?? 0),
      taxa_cancelamento: Number(r.taxa_cancelamento ?? 0),
    },
    por_dia: Array.isArray(data?.por_dia) ? data.por_dia : [],
    por_hora: Array.isArray(data?.por_hora) ? data.por_hora : [],
    por_plataforma: Array.isArray(data?.por_plataforma)
      ? data.por_plataforma
      : [],
    top_itens: Array.isArray(data?.top_itens) ? data.top_itens : [],
    por_restaurante: Array.isArray(data?.por_restaurante)
      ? data.por_restaurante
      : [],
    por_status: Array.isArray(data?.por_status) ? data.por_status : [],
  };
}

// ---------- Configuração do KDS ----------

export type KdsFieldGroup = "pedido" | "item";

export interface KdsField {
  key: string;
  label: string;
  group: KdsFieldGroup;
  default: boolean;
}

export interface KdsSettingsResponse {
  available_fields: KdsField[];
  config: { fields: Record<string, boolean>; columns: KdsColumn[] };
}

export interface KdsColumn {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_KDS_FIELDS: KdsField[] = [
  { key: "platform_badge", label: "Etiqueta da plataforma", group: "pedido", default: true },
  { key: "order_number", label: "Número do pedido", group: "pedido", default: true },
  { key: "customer_name", label: "Nome do cliente", group: "pedido", default: true },
  { key: "customer_phone", label: "Telefone do cliente", group: "pedido", default: false },
  { key: "order_time", label: "Horário do pedido (HH:mm)", group: "pedido", default: true },
  { key: "order_elapsed", label: "Tempo decorrido (há X min)", group: "pedido", default: true },
  { key: "order_type", label: "Tipo (Entrega / Retirada)", group: "pedido", default: true },
  { key: "payment_method", label: "Forma de pagamento", group: "pedido", default: false },
  { key: "delivery_address", label: "Endereço de entrega", group: "pedido", default: false },
  { key: "total_price", label: "Total do pedido", group: "pedido", default: true },
  { key: "item_image", label: "Foto do item", group: "item", default: true },
  { key: "item_name", label: "Nome do item", group: "item", default: true },
  { key: "item_quantity", label: "Quantidade", group: "item", default: true },
  { key: "item_price", label: "Preço do item", group: "item", default: false },
  { key: "item_subitems", label: "Adicionais / subitens", group: "item", default: true },
];

export const DEFAULT_KDS_COLUMNS: KdsColumn[] = [
  { key: "pendente", label: "Pendentes", visible: true, order: 0 },
  { key: "aceito", label: "Aceitos", visible: true, order: 1 },
  { key: "preparando", label: "Preparando", visible: true, order: 2 },
  { key: "aguardando", label: "Aguardando", visible: true, order: 3 },
  { key: "entregando", label: "Entregando", visible: true, order: 4 },
  { key: "no_destino", label: "No destino", visible: true, order: 5 },
  { key: "entregue", label: "Entregues", visible: true, order: 6 },
  { key: "cancelado", label: "Cancelados", visible: true, order: 7 },
];

function normalizeColumns(input: unknown): KdsColumn[] {
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_KDS_COLUMNS;
  const byKey = new Map(DEFAULT_KDS_COLUMNS.map((c) => [c.key, c]));
  const out: KdsColumn[] = [];
  input.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const r = raw as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key : null;
    if (!key) return;
    const def = byKey.get(key);
    out.push({
      key,
      label: typeof r.label === "string" ? r.label : def?.label ?? key,
      visible: typeof r.visible === "boolean" ? r.visible : def?.visible ?? true,
      order: typeof r.order === "number" ? r.order : idx,
    });
  });
  // Anexa colunas padrão que ainda não estejam presentes (mantém usuários antigos com novas etapas).
  const present = new Set(out.map((c) => c.key));
  let nextOrder = out.length;
  for (const def of DEFAULT_KDS_COLUMNS) {
    if (!present.has(def.key)) out.push({ ...def, order: nextOrder++ });
  }
  return out.sort((a, b) => a.order - b.order);
}

function buildDefaultKdsConfig(fields: KdsField[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const f of fields) map[f.key] = f.default;
  return map;
}

export async function getKdsSettings(): Promise<KdsSettingsResponse> {
  try {
    const data = await http.get<KdsSettingsResponse>("/settings/kds", { silent: true });
    const available =
      Array.isArray(data?.available_fields) && data.available_fields.length > 0
        ? data.available_fields
        : DEFAULT_KDS_FIELDS;
    const defaults = buildDefaultKdsConfig(available);
    const fields = { ...defaults, ...(data?.config?.fields ?? {}) };
    const columns = normalizeColumns((data?.config as { columns?: unknown } | undefined)?.columns);
    return { available_fields: available, config: { fields, columns } };
  } catch {
    return {
      available_fields: DEFAULT_KDS_FIELDS,
      config: { fields: buildDefaultKdsConfig(DEFAULT_KDS_FIELDS), columns: DEFAULT_KDS_COLUMNS },
    };
  }
}

export async function updateKdsSettings(
  fields: Record<string, boolean>,
): Promise<KdsSettingsResponse> {
  return http.put<KdsSettingsResponse>("/settings/kds", { fields });
}

export async function updateKdsColumns(columns: KdsColumn[]): Promise<KdsSettingsResponse> {
  const payload = columns.map((c, idx) => ({ key: c.key, visible: c.visible, order: idx }));
  return http.put<KdsSettingsResponse>("/settings/kds", { columns: payload });
}

/** Version that THROWS on failure (for the config dialog to show error state). */
export async function fetchKdsColumnsStrict(): Promise<KdsColumn[]> {
  const data = await http.get<KdsSettingsResponse>("/settings/kds");
  return normalizeColumns((data?.config as { columns?: unknown } | undefined)?.columns);
}

/** Restaura as configurações do KDS ao padrão no backend e retorna o config atualizado. */
export async function resetKdsSettings(): Promise<KdsSettingsResponse> {
  const data = await http.post<KdsSettingsResponse>("/settings/kds/reset", {});
  const available =
    Array.isArray(data?.available_fields) && data.available_fields.length > 0
      ? data.available_fields
      : DEFAULT_KDS_FIELDS;
  const defaults = buildDefaultKdsConfig(available);
  const fields = { ...defaults, ...(data?.config?.fields ?? {}) };
  const columns = normalizeColumns((data?.config as { columns?: unknown } | undefined)?.columns);
  return { available_fields: available, config: { fields, columns } };
}
