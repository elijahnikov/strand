import { useCallback, useEffect, useState } from "react";
import {
  clearToken,
  getToken,
  type StoredAuth,
  subscribeToAuth,
} from "@/lib/auth";

type Status = "loading" | "ready";

export function useAuth(): {
  auth: StoredAuth | null;
  status: Status;
  disconnect: () => Promise<void>;
} {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    getToken()
      .then((stored) => {
        if (cancelled) {
          return;
        }
        setAuth(stored);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus("ready");
      });
    const unsubscribe = subscribeToAuth((next) => setAuth(next));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const disconnect = useCallback(async () => {
    await clearToken();
  }, []);

  return { auth, status, disconnect };
}
