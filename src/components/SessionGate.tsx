"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT, api, hasAccessToken, refreshSession } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";
import { ShellProvider, applyTheme } from "@/components/shell/ShellContext";

const MIN_LOADING_MS = 900; // para que la pantalla de carga no parpadee

/**
 * Asegura que haya sesión antes de mostrar la app: si no hay access token en memoria, intenta renovarlo
 * con la cookie; si no se puede, manda al login.
 * TODO: reemplazar la redirección por el modal "Tu sesión venció" cuando la app tenga cambios pendientes.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      if (!hasAccessToken() && !(await refreshSession())) return router.replace("/entrar");
      try {
        const { user } = await api<{ user: UserDto }>("/me");
        applyTheme(user.theme);
        await new Promise((r) => setTimeout(r, Math.max(0, MIN_LOADING_MS - (Date.now() - started))));
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

  if (!user) {
    return (
      <main aria-busy="true" aria-label="Cargando" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bolsi/bolsi-cargando.svg" alt="" width={96} height={104} />
      </main>
    );
  }

  return (
    <ShellProvider initialUser={user}>
      <AppShell>{children}</AppShell>
    </ShellProvider>
  );
}
