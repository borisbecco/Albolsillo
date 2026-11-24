"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT } from "@/lib/month";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { TxIcon } from "@/components/tx/parts";
import t from "@/components/tx/tx.module.css";
import a from "./auto.module.css";

type Edit = { on: boolean; category_id: string; account_id: string | null; catEdited: boolean; learn: boolean };

const OUT_CATS = CATEGORIES.filter((c) => c.type === "out" && c.id !== "prestamo");
const dstr = (d: string) => `${Number(d.slice(8))} ${MONTH_SHORT[Number(d.slice(5, 7)) - 1]}`;

/** Bandeja de gastos detectados: nada se suma sin confirmar. Marca posibles duplicados y aprende categorías. */
export function DetectedSheet() {
  const { setAutoSheet, flash } = useShell();
  const { detected, accounts, confirmDetected, discardDetected } = useData();
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(false);
  const close = () => setAutoSheet(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAutoSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setAutoSheet]);

  // Estado de cada fila: marcada salvo que sea posible duplicado.
  const ed = (id: string): Edit => {
    const d = detected.find((x) => x.id === id)!;
    return edits[id] ?? { on: !d.possible_duplicate_of, category_id: d.category_id, account_id: d.account_id, catEdited: false, learn: true };
  };
  const set = (id: string, p: Partial<Edit>) => setEdits((m) => ({ ...m, [id]: { ...ed(id), ...p } }));

  const sel = detected.filter((d) => ed(d.id).on);
  const total = sel.reduce((s, d) => s + Number(d.amount) * (d.currency === "USD" ? 0 : 1), 0);

  const confirm = async () => {
    if (!sel.length) return;
    setBusy(true);
    const learn = sel.filter((d) => ed(d.id).catEdited && ed(d.id).learn).map((d) => ({ id: d.id, category_id: ed(d.id).category_id }));
    const changes = Object.fromEntries(sel.map((d) => [d.id, { category_id: ed(d.id).category_id, account_id: ed(d.id).account_id }]));
    const r = await confirmDetected(
      sel.map((d) => d.id),
      learn,
      changes,
    );
    setBusy(false);
    if (!r) return;
    setEdits({});
    flash(
      (r.count === 1 ? "Sumamos 1 gasto" : `Sumamos ${r.count} gastos`) + (r.learned ? ` y aprendimos ${r.learned === 1 ? "1 categoría" : `${r.learned} categorías`}` : ""),
      "gasto",
    );
    if (detected.length === sel.length) close();
  };

  return (
    <div className={t.backdrop} onClick={close} style={{ zIndex: 34 }}>
      <div className={`${t.sheet} ${a.sheet}`} role="dialog" aria-modal="true" aria-label="Gastos detectados" onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <span className={a.title}>Gastos detectados</span>
          <span style={{ flex: 1 }} />
          <button className={a.pill} onClick={() => setAutoSheet("sources")} title="Fuentes">
            <span className="material-symbols-rounded">bolt</span>Fuentes
          </button>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={close}>
            close
          </button>
        </div>

        {detected.length ? (
          <>
            <span className={a.lead}>Marcá los que querés sumar y revisá la categoría y la cuenta. Los que no marques quedan acá para después.</span>
            <div className={a.det}>
              {detected.map((d) => {
                const e = ed(d.id);
                const accs = accounts.filter((x) => x.currency === d.currency);
                return (
                  <div key={d.id} className={a.detRow} style={{ opacity: e.on ? 1 : 0.6 }}>
                    <div className={a.detTop}>
                      <input type="checkbox" checked={e.on} onChange={() => set(d.id, { on: !e.on })} aria-label={`Sumar ${d.merchant}`} />
                      <TxIcon categoryId={e.category_id} domain={d.merchant_domain} size={36} />
                      <div className={a.detMain}>
                        <strong>{d.merchant}</strong>
                        <div className={a.detMeta}>
                          <span className="material-symbols-rounded">{d.origin === "mail" ? "mail" : "ios_share"}</span>
                          <span>
                            {d.origin === "mail" ? `Mail de ${d.wallet ?? "tu billetera"}` : "Comprobante compartido"} · {dstr(d.date)}
                          </span>
                          {d.possible_duplicate_of && <span className={a.dup}>Posible duplicado</span>}
                          {d.learned && !e.catEdited && (
                            <span className={a.learned}>
                              <span className="material-symbols-rounded">auto_awesome</span>Categoría aprendida
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={a.detAmount}>{formatMoney(Number(d.amount), d.currency)}</span>
                      <button className={`${a.discard} material-symbols-rounded`} title="Descartar" onClick={() => void discardDetected(d.id)}>
                        close
                      </button>
                    </div>
                    <div className={a.detSelects}>
                      <select value={e.category_id} onChange={(ev) => set(d.id, { category_id: ev.target.value, catEdited: true })} aria-label="Categoría">
                        {OUT_CATS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select value={e.account_id ?? ""} onChange={(ev) => set(d.id, { account_id: ev.target.value || null })} aria-label="Cuenta">
                        <option value="">Sin cuenta</option>
                        {accs.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {e.catEdited && (
                      <label className={a.learn}>
                        <input type="checkbox" checked={e.learn} onChange={() => set(d.id, { learn: !e.learn })} />
                        Usar siempre «{CATEGORY_BY_ID[e.category_id]?.name}» para {d.merchant}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={a.detFoot}>
              <span>{sel.length ? `${sel.length} de ${detected.length} marcados · ${formatMoney(total, "ARS")}` : "Ninguno marcado"}</span>
              <button className={t.primary} disabled={!sel.length || busy} onClick={confirm}>
                {busy ? "Sumando…" : sel.length === 1 ? "Sumar 1 gasto" : `Sumar ${sel.length} gastos`}
              </button>
            </div>
          </>
        ) : (
          <div className={a.wait}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bolsi/bolsi-bienvenida.svg" alt="" width={96} height={105} />
            <strong>Estás al día</strong>
            <span>Cuando llegue un aviso de pago reenviado o compartas un comprobante, lo vas a ver acá.</span>
          </div>
        )}
      </div>
    </div>
  );
}
