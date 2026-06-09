import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingBag, Store, Zap, Plug, BarChart3, Settings, UtensilsCrossed } from "lucide-react";
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
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">Delivery Auto Pro</span>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            RA
          </div>
          <div className="flex flex-col text-xs">
            <span className="font-medium">Restaurante Admin</span>
            <span className="text-muted-foreground">admin@deliverypro.com</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}