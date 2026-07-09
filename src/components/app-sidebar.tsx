import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingBag, Store, Zap, Plug, BarChart3, Settings, LogOut, Shield, BookOpen, Bug } from "lucide-react";
import { useEffect, useState } from "react";
import { getUser, logout, type AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/logo.webp.asset.json";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Pedidos", url: "/orders", icon: ShoppingBag },
  { title: "Restaurantes", url: "/restaurants", icon: Store },
  { title: "Automações", url: "/automations", icon: Zap },
  { title: "Integrações", url: "/integrations", icon: Plug },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Depuração de Pedidos", url: "/debug-pedidos", icon: Bug },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    window.addEventListener("auth-user-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-user-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const initials = (user?.name ?? "RA")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <img
            src={logoAsset.url}
            alt="Zero Tempo"
            className="h-9 w-9 rounded-lg object-contain"
          />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">Zero Tempo</span>
            <span className="text-[11px] text-muted-foreground">Painel do restaurante</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {(user as { is_admin?: boolean } | null)?.is_admin === true && (
                <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin"
                  >
                    <Link to="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/menu-manager")}
                    tooltip="Cardápios"
                  >
                    <Link to="/menu-manager" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      <span>Cardápios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col text-xs">
            <span className="truncate font-medium">{user?.name ?? "Restaurante Admin"}</span>
            <span className="truncate text-muted-foreground">
              {user?.email ?? "admin@zerotempo.com"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 shrink-0"
            onClick={() => logout()}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}