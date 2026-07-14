import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAuthenticated } from "@/lib/auth";
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
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
              </Button>
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