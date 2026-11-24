"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT, api, hasAccessToken, refreshSession } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";

/**
 * Asegura que haya sesión antes de mostrar la app: si no hay access token en memoria, intenta renovarlo
 * con la cookie; si no se puede, manda al login.
 * TODO: reemplazar la redirección por el modal "Tu sesión venció" cuando la app tenga cambios pendientes.
 */
export function SessionGate({ children }: { children: (user: UserDto) => ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!hasAccessToken() && !(await refreshSession())) return router.replace("/entrar");
      try {
        const { user } = await api<{ user: UserDto }>("/me");
        if (alive) setUser(user);
      } catch {
        router.replace("/entrar");
      }
    })();
    const onExpired = () => router.replace("/entrar");
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      alive = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [router]);

  useEffect(() => {
    if (user) document.documentElement.dataset.theme = user.theme;
  }, [user]);

  if (!user) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bolsi/bolsi-cargando.svg" alt="Cargando" width={96} height={96} />
      </main>
    );
  }
  return children(user);
}
