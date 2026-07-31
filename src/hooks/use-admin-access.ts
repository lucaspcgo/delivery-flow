import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { verifyUserRole, type AppRole } from "@/lib/api";

export type AdminAccessStatus = "checking" | "allowed" | "denied";

export interface AdminAccessState {
  status: AdminAccessStatus;
  role: AppRole | null;
  isSuperAdmin: boolean;
}

/**
 * Verifica no servidor (/auth/me) se o usuário logado pode ver a área admin.
 * `level: "admin"` exige role admin/is_admin. `level: "manager"` aceita gerente.
 * Nunca concede acesso a partir do localStorage — ele é apenas cache de exibição.
 */
export function useAdminAccess(
  level: "admin" | "manager" = "manager",
  options: { redirectOnDeny?: boolean } = {},
): AdminAccessState {
  const { redirectOnDeny = true } = options;
  const navigate = useNavigate();
  const [status, setStatus] = useState<AdminAccessStatus>("checking");
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let alive = true;
    verifyUserRole(true)
      .then((resolved) => {
        if (!alive) return;
        setRole(resolved);
        const allowed =
          resolved === "admin" || (level === "manager" && resolved === "gerente");
        if (allowed) {
          setStatus("allowed");
          return;
        }
        setStatus("denied");
        if (redirectOnDeny) navigate({ to: "/dashboard", replace: true });
      })
      .catch(() => {
        if (!alive) return;
        setRole(null);
        setStatus("denied");
        if (redirectOnDeny) navigate({ to: "/dashboard", replace: true });
      });
    return () => {
      alive = false;
    };
  }, [level, navigate, redirectOnDeny]);

  return { status, role, isSuperAdmin: role === "admin" };
}
