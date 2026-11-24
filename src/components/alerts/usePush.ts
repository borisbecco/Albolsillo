"use client";

import { useState } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";
import { useShell } from "@/components/shell/ShellContext";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Activar/desactivar los avisos del navegador (Web Push). */
export function usePush() {
  const { user, setUser, flash } = useShell();
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID;

  const enable = async () => {
    if (!supported) return flash("Tu navegador no soporta notificaciones");
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        flash("Para recibir avisos, permití las notificaciones en el navegador");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await api<{ user: UserDto }>("/me/push", { method: "POST", body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
      setUser(res.user);
      flash("Listo, te avisamos en este navegador");
    } catch (e) {
      flash(e instanceof ApiClientError ? e.message : "No pudimos activar las notificaciones.", "errorguardar");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      const res = await api<{ user: UserDto }>("/me/push", { method: "DELETE" });
      setUser(res.user);
    } catch (e) {
      flash(e instanceof ApiClientError ? e.message : "No pudimos desactivarlas.", "errorguardar");
    } finally {
      setBusy(false);
    }
  };

  return { supported, enabled: user.push_enabled, busy, enable, disable };
}
