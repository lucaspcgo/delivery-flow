export type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";
export type Marketplace = "iFood" | "Keeta" | "99Food";

export interface Order {
  id: string;
  code: string;
  customer: string;
  marketplace: Marketplace;
  store: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  prepTime: number;
}

export interface Store {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  active: boolean;
  ordersToday: number;
}

const customers = ["João Silva", "Maria Souza", "Pedro Lima", "Ana Costa", "Carlos Rocha", "Beatriz Alves", "Rafael Mendes", "Juliana Dias", "Lucas Pereira", "Fernanda Castro"];
const markets: Marketplace[] = ["iFood", "Keeta", "99Food"];
const statuses: OrderStatus[] = ["pending", "accepted", "preparing", "ready", "delivered", "cancelled"];
const dishes = [
  { name: "Hambúrguer Artesanal", price: 38.9 },
  { name: "Pizza Calabresa", price: 54.0 },
  { name: "Sushi Combo 20pç", price: 89.9 },
  { name: "Açaí 500ml", price: 22.5 },
  { name: "Coca-Cola 2L", price: 12.0 },
  { name: "Batata Frita G", price: 18.0 },
  { name: "Salada Caesar", price: 32.0 },
  { name: "Brownie c/ Sorvete", price: 19.9 },
];

export const stores: Store[] = [
  { id: "s1", name: "Burger House - Centro", cnpj: "12.345.678/0001-90", phone: "(11) 99812-4521", address: "Rua das Flores, 123 - Centro, São Paulo/SP", active: true, ordersToday: 84 },
  { id: "s2", name: "Pizzaria Bella - Moema", cnpj: "98.765.432/0001-10", phone: "(11) 99876-3344", address: "Av. Ibirapuera, 2200 - Moema, São Paulo/SP", active: true, ordersToday: 47 },
  { id: "s3", name: "Sushi Yama - Pinheiros", cnpj: "11.222.333/0001-44", phone: "(11) 98765-1212", address: "R. dos Pinheiros, 500 - Pinheiros, São Paulo/SP", active: true, ordersToday: 32 },
  { id: "s4", name: "Açaí Tropical - Vila Olímpia", cnpj: "55.666.777/0001-22", phone: "(11) 97777-8888", address: "R. Funchal, 100 - Vila Olímpia, São Paulo/SP", active: false, ordersToday: 0 },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateOrders(n: number): Order[] {
  const out: Order[] = [];
  for (let i = 0; i < n; i++) {
    const itemCount = 1 + Math.floor(Math.random() * 3);
    const items = Array.from({ length: itemCount }, () => {
      const d = rand(dishes);
      return { name: d.name, qty: 1 + Math.floor(Math.random() * 2), price: d.price };
    });
    const total = items.reduce((s, it) => s + it.qty * it.price, 0);
    const minutesAgo = Math.floor(Math.random() * 240);
    const created = new Date(Date.now() - minutesAgo * 60_000);
    out.push({
      id: `o${i + 1}`,
      code: `#${(10240 + i).toString()}`,
      customer: rand(customers),
      marketplace: rand(markets),
      store: rand(stores).name,
      items,
      total,
      status: rand(statuses),
      createdAt: created.toISOString(),
      prepTime: 10 + Math.floor(Math.random() * 25),
    });
  }
  return out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export const orders: Order[] = generateOrders(36);

export const ordersByHour = Array.from({ length: 12 }, (_, i) => {
  const hour = 10 + i;
  return {
    hour: `${hour}h`,
    pedidos: Math.floor(8 + Math.random() * 40),
  };
});

export const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return {
    day: days[i],
    pedidos: 80 + Math.floor(Math.random() * 120),
    faturamento: 2500 + Math.floor(Math.random() * 4000),
  };
});

export const integrations = [
  { id: "ifood", name: "iFood", description: "Maior marketplace de delivery do Brasil. Receba pedidos automaticamente.", color: "#EA1D2C", connected: true, ordersToday: 142 },
  { id: "keeta", name: "Keeta", description: "Plataforma global de delivery em rápida expansão no mercado.", color: "#FFCD00", connected: false, ordersToday: 0 },
  { id: "99food", name: "99Food", description: "Serviço de delivery da 99, integrado ao app de mobilidade.", color: "#FFD300", connected: true, ordersToday: 38 },
];

export const statusLabel: Record<OrderStatus, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  preparing: "Em preparo",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const statusColor: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-violet-100 text-violet-800 border-violet-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  delivered: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};