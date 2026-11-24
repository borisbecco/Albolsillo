"use client";

import { useRouter } from "next/navigation";
import { SessionGate } from "@/components/SessionGate";
import { logout } from "@/lib/api-client";

// Provisorio: se reemplaza por el armazón de la app (Inicio).
export default function Home() {
  const router = useRouter();
  return (
    <SessionGate>
      {(user) => (
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "var(--gutter)" }}>
          <div className="card" style={{ maxWidth: 420, textAlign: "center", display: "grid", gap: 16, justifyItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bolsi/bolsi-bienvenida.svg" alt="" width={120} height={120} />
            <h1 style={{ fontSize: 22 }}>Hola, {user.name.split(" ")[0]}</h1>
            <p style={{ color: "var(--mut)", margin: 0 }}>Entraste como {user.email}. Bolsi te banca.</p>
            <button
              onClick={async () => {
                await logout();
                router.replace("/entrar");
              }}
              style={{ height: 42, padding: "0 20px", borderRadius: 14, border: "1px solid var(--line2)", background: "var(--elev)", cursor: "pointer" }}
            >
              Cerrar sesión
            </button>
          </div>
        </main>
      )}
    </SessionGate>
  );
}
