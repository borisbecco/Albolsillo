"use client";

import { formatMoney } from "@/lib/money";
import type { UserDto } from "@/lib/auth/session";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import h from "./dashboard.module.css";

const TYPES: [Exclude<UserDto["rate_type"], "manual">, string][] = [
  ["oficial", "Oficial"],
  ["blue", "Blue"],
  ["bolsa", "MEP"],
  ["tarjeta", "Tarjeta"],
];

/** "Dólar hoy": las 4 cotizaciones; tocar una la elige para convertir los US$. */
export function FxCard() {
  const { user, updatePrefs } = useShell();
  const { fx, rate } = useData();
  const live = fx && !fx.stale;
  const updated = fx?.blue?.updated_at ? new Date(fx.blue.updated_at) : null;
  const selName = user.rate_type === "manual" ? "manual" : (TYPES.find((t) => t[0] === user.rate_type)?.[1] ?? "").toLowerCase();

  return (
    <section className={h.panel}>
      <div className={h.blockHead}>
        <span className={h.blockTitle}>Dólar hoy</span>
        <span className={h.fxStatus} title={updated ? `Actualizado ${updated.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}` : undefined}>
          <i style={{ background: live ? "var(--pos)" : "var(--dim)", boxShadow: live ? "0 0 8px var(--pos)" : "none" }} />
          {!fx ? "Cargando…" : live ? "En vivo" : `Sin conexión${updated ? ` · ${updated.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}` : ""}`}
        </span>
      </div>
      <div className={h.fxGrid}>
        {TYPES.map(([k, label]) => {
          const q = fx?.[k];
          const on = user.rate_type === k;
          return (
            <button key={k} className={h.fxItem} aria-pressed={on} onClick={() => !on && updatePrefs({ rate_type: k })}>
              <span className={h.fxName}>
                {label}
                <span className={`${h.fxCheck} material-symbols-rounded`}>{on ? "check" : ""}</span>
              </span>
              <strong>{q ? formatMoney(Number(q.sell), "ARS") : "—"}</strong>
              <span className={h.fxBuy}>Compra {q ? formatMoney(Number(q.buy), "ARS") : "—"}</span>
            </button>
          );
        })}
      </div>
      <div className={h.fxNote}>
        Convertimos los US$ con el dólar {selName}
        {rate ? ` (${formatMoney(rate, "ARS")})` : ""}.
      </div>
    </section>
  );
}
