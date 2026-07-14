import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getUsage, type UsageResponse } from "./api";

interface UsageCtx {
  usage: UsageResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<UsageCtx>({ usage: null, loading: false, refresh: async () => {} });

export function UsageProvider({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUsage();
      setUsage(data);
    } catch {
      /* ignore, plan gating events handle 403s */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return <Ctx.Provider value={{ usage, loading, refresh }}>{children}</Ctx.Provider>;
}

export function useUsage() {
  return useContext(Ctx);
}