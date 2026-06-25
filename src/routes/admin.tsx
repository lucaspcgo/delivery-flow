import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Receipt, Settings, ArrowLeft, Shield } from "lucide-react";
import { logout } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const menu = [
  { url: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { url: "/admin/users", label: "Usuários", icon: Users },
  { url: "/admin/invoices", label: "Faturas", icon: Receipt },
  { url: "/admin/settings", label: "Configurações API", icon: Settings },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      const token = window.localStorage.getItem("auth_token");
      const raw = window.localStorage.getItem("auth_user");
      const user = raw ? JSON.parse(raw) : null;
      if (!token) {
        window.location.href = "/login";
        return;
      }
      if (!user?.is_admin) {
        window.location.href = "/dashboard";
        return;
      }
      setOk(true);
    } catch {
      window.location.href = "/dashboard";
    }
  }, []);

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside
        className="flex w-64 flex-col text-slate-100"
        style={{ backgroundColor: "#1a1d27" }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <Shield className="h-6 w-6 text-yellow-400" />
          <div>
            <div className="text-sm font-semibold">Admin Panel</div>
            <div className="text-xs text-slate-400">Zero Tempo</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {menu.map((m) => {
            const active = pathname === m.url || pathname.startsWith(m.url + "/");
            return (
              <Link
                key={m.url}
                to={m.url}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-yellow-400/15 text-yellow-300"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Link>
            );
          })}
          <div className="my-3 border-t border-white/10" />
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Painel
          </Link>
        </nav>
        <div className="border-t border-white/10 p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white"
            onClick={() => logout()}
          >
            Sair
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}