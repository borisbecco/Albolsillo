"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import n from "./month.module.css";
import { Bolsi, preloadBolsi } from "@/components/bolsi/Bolsi";

/** Modal bloqueante "Tu sesión venció". Los cambios pendientes quedan en el dispositivo. */
export function SessionExpiredModal() {
  const router = useRouter();
  const { sessionExpired } = useShell();
  const { pendingCount } = useData();
  if (!sessionExpired) return null;
  return (
    <div className={n.backdrop} style={{ zIndex: 50, alignItems: "center" }}>
      <div className={`${n.modal} ${n.expired}`} role="alertdialog" aria-modal="true" aria-label="Tu sesión venció">
        <Bolsi pose="sesion" width={88} height={96} />
        <strong>Tu sesión venció</strong>
        <span>
          Por seguridad cerramos la sesión después de 30 días sin entrar. Volvé a ingresar para seguir; no perdés nada de lo que cargaste
          {pendingCount ? ` (${pendingCount} ${pendingCount === 1 ? "cambio guardado" : "cambios guardados"} en este dispositivo)` : ""}.
        </span>
        <button className={n.primary} onClick={() => router.replace("/entrar")}>
          Volver a entrar
        </button>
      </div>
    </div>
  );
}

/** Banda "Sin conexión" / "Sincronizando" debajo del encabezado. Al volver la conexión reintenta lo pendiente. */
export function NetBanner() {
  const { flash } = useShell();
  const { pendingCount, retryPending } = useData();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Al reconectar con cambios pendientes, se sincronizan solos.
  useEffect(() => {
    if (!online || !pendingCount) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncing(true);
    retryPending().then((ok) => {
      if (!alive) return;
      setSyncing(false);
      if (ok) flash(`Sincronizamos ${ok} ${ok === 1 ? "cambio" : "cambios"}`);
    });
    return () => {
      alive = false;
    };
    // Solo al volver la conexión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Las poses de Bolsi de estos estados se precargan para que se vean aunque se corte la conexión.
  useEffect(() => preloadBolsi(["sinconexion", "cargando", "errorguardar", "sesion", "gasto", "ingreso", "meta", "alerta", "bienvenida", "errorcarga"]), []);
  const preload = (
    <span hidden aria-hidden>
      {["sinconexion", "cargando", "errorguardar", "sesion", "gasto", "ingreso", "meta", "alerta", "bienvenida", "errorcarga"].map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p} src={`/bolsi/bolsi-${p}.svg`} alt="" />
      ))}
    </span>
  );
  if (online && !syncing) return preload;
  const off = !online;
  const color = off ? "var(--amb)" : "var(--acc)";
  return (
    <>
    {preload}
    <div className={n.net} role="status" style={{ background: `color-mix(in oklch, ${color} 10%, var(--panel))`, borderColor: `color-mix(in oklch, ${color} 35%, var(--line2))` }}>
      <Bolsi key={off ? "off" : "sync"} pose={off ? "sinconexion" : "cargando"} />
      <span>
        <strong>{off ? "Sin conexión" : "Sincronizando"}</strong>
        <small>
          {off
            ? pendingCount
              ? `${pendingCount} ${pendingCount === 1 ? "cambio guardado" : "cambios guardados"} en este dispositivo. Se sincronizan al volver la conexión.`
              : "Podés seguir cargando; guardamos todo en este dispositivo."
            : "Subiendo los cambios que hiciste sin conexión…"}
        </small>
      </span>
    </div>
    </>
  );
}
