"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT, api, hasAccessToken, refreshSession } from "@/lib/api-client";
import { currentMonth } from "@/lib/month";
import { AppShell } from "@/components/shell/AppShell";
import { ShellProvider, applyTheme } from "@/components/shell/ShellContext";
import { DataProvider, type Bootstrap } from "@/components/data/DataContext";

const MIN_LOADING_MS = 900; // para que la pantalla de carga no parpadee

/**
 * Asegura que haya sesión antes de mostrar la app: si no hay access token en memoria, intenta renovarlo
 * con la cookie; si no se puede, manda al login.
 * TODO: reemplazar la redirección por el modal "Tu sesión venció" cuando la app tenga cambios pendientes.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      if (!hasAccessToken() && !(await refreshSession())) return router.replace("/entrar");
      try {
        const boot = await api<Bootstrap>(`/me/bootstrap?month=${currentMonth()}`);
        applyTheme(boot.user.theme);
        await new Promise((r) => setTimeout(r, Math.max(0, MIN_LOADING_MS - (Date.now() - started))));
        if (alive) setData(boot);
      } catch (e) {
        // La sesión vencida ya redirige por el evento; el resto es "Error al cargar".
        if (alive && !(e instanceof Error && "code" in e && e.code === "session_expired")) setLoadError(true);
      }
    })();
    const onExpired = () => router.replace("/entrar");
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      alive = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [router, attempt]);

  if (loadError) {
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
        <section role="alert" className="card" style={{ maxWidth: 420, display: "grid", gap: 12, justifyItems: "center", textAlign: "center", padding: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bolsi/bolsi-errorcarga.svg" alt="" width={96} height={104} />
          <h1 style={{ fontSize: 20 }}>No pudimos cargar tus datos</h1>
          <p style={{ margin: 0, color: "var(--mut)" }}>
            Revisá tu conexión y probá de nuevo. Si sigue pasando, escribinos a ayuda@albolsillo.app.
          </p>
          <button
            onClick={() => {
              setLoadError(false);
              setAttempt((a) => a + 1);
            }}
            style={{ height: 44, padding: "0 20px", borderRadius: 14, border: 0, background: "var(--acc)", color: "var(--onacc)", fontWeight: 600, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main aria-busy="true" aria-label="Cargando" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bolsi/bolsi-cargando.svg" alt="" width={96} height={104} />
      </main>
    );
  }

  return (
    <ShellProvider initialUser={data.user}>
      <DataProvider initial={data}>
        <AppShell>{children}</AppShell>
      </DataProvider>
    </ShellProvider>
  );
}
