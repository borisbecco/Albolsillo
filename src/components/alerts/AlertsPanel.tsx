"use client";

import { useEffect } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { useAlerts } from "./useAlerts";
import { usePush } from "./usePush";
import a from "./alerts.module.css";

/** Panel de la campana: alertas activas, anticipación y avisos por mail. */
export function AlertsPanel() {
  const { alertsOpen, setAlertsOpen, user, updatePrefs } = useShell();
  const alerts = useAlerts();
  const push = usePush();

  useEffect(() => {
    if (!alertsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAlertsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alertsOpen, setAlertsOpen]);

  if (!alertsOpen) return null;
  const mailOn = user.mail_alerts !== "off";

  return (
    <div className={a.backdrop} onClick={() => setAlertsOpen(false)}>
      <div className={a.panel} role="dialog" aria-modal="true" aria-label="Alertas" onClick={(e) => e.stopPropagation()}>
        <div className={a.head}>
          <div className={a.titleRow}>
            <strong>Alertas</strong>
            <span>
              {alerts.length} {alerts.length === 1 ? "activa" : "activas"}
            </span>
          </div>
          <div className={a.days}>
            <span>Avisarme con</span>
            <div className={a.seg} role="group" aria-label="Anticipación">
              {([1, 3, 7] as const).map((d) => (
                <button key={d} aria-pressed={user.alert_days === d} onClick={() => updatePrefs({ alert_days: d })}>
                  {d} {d === 1 ? "día" : "días"}
                </button>
              ))}
            </div>
            <span>de anticipación</span>
          </div>
        </div>

        <div className={a.list}>
          {alerts.map((x) => (
            <div key={x.key} className={a.item}>
              <span className={`${a.icon} material-symbols-rounded`} style={{ color: x.color, background: `color-mix(in oklch, ${x.color} 16%, transparent)` }}>
                {x.icon}
              </span>
              <div>
                <strong>{x.title}</strong>
                <span>{x.sub}</span>
              </div>
            </div>
          ))}
          {!alerts.length && (
            <div className={a.empty}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/bolsi/bolsi-bienvenida.svg" alt="" width={72} height={79} />
              <span>Nada urgente en estos días. Bolsi te banca.</span>
            </div>
          )}
        </div>

        <div className={a.foot}>
          <div className={a.channel}>
            <span className={`${a.icon} material-symbols-rounded`} style={{ color: "var(--pos)", background: "color-mix(in oklch, var(--pos) 16%, transparent)" }}>
              notifications_active
            </span>
            <div>
              <strong>En la app</strong>
              <span>Siempre activos en la campana</span>
            </div>
            <span className="material-symbols-rounded" style={{ color: "var(--pos)" }}>
              check_circle
            </span>
          </div>
          {push.supported && (
            <div className={a.channel}>
              <span className={`${a.icon} material-symbols-rounded`} style={{ color: "var(--acc2)", background: "var(--sel)" }}>
                devices
              </span>
              <div>
                <strong>En el navegador</strong>
                <span>{push.enabled ? "Activos en este dispositivo" : "Te avisamos aunque no tengas la app abierta"}</span>
              </div>
              <button
                className={a.switch}
                role="switch"
                aria-checked={push.enabled}
                aria-label="Avisos del navegador"
                disabled={push.busy}
                onClick={() => (push.enabled ? push.disable() : push.enable())}
              >
                <span />
              </button>
            </div>
          )}
          <div className={a.channel}>
            <span className={`${a.icon} material-symbols-rounded`} style={{ color: "var(--acc2)", background: "var(--sel)" }}>
              mail
            </span>
            <div>
              <strong>Por mail</strong>
              <span>{mailOn ? `${user.mail_alerts === "daily" ? "Resumen diario a las 8" : "Cada aviso"} a ${user.email}` : "Desactivados"}</span>
            </div>
            <button
              className={a.switch}
              role="switch"
              aria-checked={mailOn}
              aria-label="Avisos por mail"
              onClick={() => updatePrefs({ mail_alerts: mailOn ? "off" : "each" })}
            >
              <span />
            </button>
          </div>
          {mailOn && (
            <div className={a.seg} style={{ marginLeft: 46, alignSelf: "flex-start" }} role="group" aria-label="Frecuencia de mails">
              <button aria-pressed={user.mail_alerts === "each"} onClick={() => updatePrefs({ mail_alerts: "each" })}>
                Cada aviso
              </button>
              <button aria-pressed={user.mail_alerts === "daily"} onClick={() => updatePrefs({ mail_alerts: "daily" })}>
                Resumen diario
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
