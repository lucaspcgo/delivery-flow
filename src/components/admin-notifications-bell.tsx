import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getAdminNotifications,
  type AdminNotification,
  type AdminNotificationsResponse,
} from "@/lib/api";

function severityClasses(severity: string): string {
  switch (severity) {
    case "high":
      return "border-l-4 border-red-500 bg-red-500/5";
    case "medium":
      return "border-l-4 border-yellow-500 bg-yellow-500/5";
    default:
      return "border-l-4 border-blue-500 bg-blue-500/5";
  }
}

function severityDot(severity: string): string {
  switch (severity) {
    case "high":
      return "bg-red-500";
    case "medium":
      return "bg-yellow-500";
    default:
      return "bg-blue-500";
  }
}

export function AdminNotificationsBell() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminNotificationsResponse | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getAdminNotifications();
      setData(res);
    } catch {
      // silencioso: sino apenas some se der erro
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const unread = data?.unread_count ?? 0;
  const items: AdminNotification[] = data?.notifications ?? [];

  const handleClick = (n: AdminNotification) => {
    setOpen(false);
    if (!n.link) return;
    try {
      if (n.link.startsWith("http")) {
        window.location.href = n.link;
      } else {
        navigate({ to: n.link });
      }
    } catch {
      window.location.href = n.link;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <span className="text-xs text-muted-foreground">{unread} não lidas</span>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={cn(
                  "flex w-full flex-col gap-1 px-3 py-2 text-left transition hover:bg-muted",
                  severityClasses(n.severity),
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", severityDot(n.severity))} />
                  <span className="text-sm font-medium">{n.title}</span>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{n.message}</p>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}