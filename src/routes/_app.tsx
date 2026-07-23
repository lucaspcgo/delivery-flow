import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { isAuthenticated } from "@/lib/auth";
import { hasAdminAccess, getStoredUser } from "@/lib/api";
import { AdminNotificationsBell } from "@/components/admin-notifications-bell";
import { useEffect, useState } from "react";
import { TrialBanner } from "@/components/trial-banner";
import { UsageProvider } from "@/lib/usage-context";
import { PlanLimitModal } from "@/components/plan-limit-modal";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    setIsAdmin(hasAdminAccess(getStoredUser()));
  }, []);
  return (
    <UsageProvider>
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-muted/30">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur sm:gap-3 sm:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              {isAdmin && <AdminNotificationsBell />}
            </div>
          </header>
          <TrialBanner />
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
    <PlanLimitModal />
    </UsageProvider>
  );
}