"use client";

import { useEffect, useRef, useState } from "react";
import { BANK_BY_ID, type BankId } from "@/lib/banks";
import { pickableCategories } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_SHORT } from "@/lib/month";
import { useData, type ImportPreview } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import m from "./import.module.css";

const KIND_BADGE: Record<string, { label: string; color: string } | undefined> = {
  installment: { label: "Cuota", color: "var(--acc2)" },
  tax: { label: "Impuesto", color: "var(--amb)" },
  fee: { label: "Cargo", color: "var(--amb)" },
  payment: { label: "Pago (no se importa)", color: "var(--dim)" },
};

/** Importar resumen: elegir tarjeta y PDF, revisar fila por fila y confirmar. */
export function ImportModal() {
  const { importFor, setImportFor } = useShell();
  if (!importFor) return null;
  return <Flow initialCard={importFor.cardId} onClose={() => setImportFor(null)} />;
}

function Flow({ initialCard, onClose }: { initialCard: string | null; onClose: () => void }) {
  const { flash } = useShell();
  const { cards, importStatement, confirmImport } = useData();
  const [cardId, setCardId] = useState(initialCard ?? cards[0]?.id ?? "");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [cats, setCats] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const card = cards.find((c) => c.id === cardId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!cardId) return flash("Elegí la tarjeta del resumen");
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return flash("El archivo tiene que ser un PDF");
    setBusy(true);
    const res = await importStatement(cardId, file);
    setBusy(false);
    if (!res) return;
    setPreview(res);
    // Por defecto: todo lo que no es pago ni ya cargado.
    setOn(Object.fromEntries(res.rows.map((r) => [r.row_id, r.kind !== "payment" && !r.duplicate])));
    setCats(Object.fromEntries(res.rows.map((r) => [r.row_id, r.suggested_category])));
  };

  const confirm = async () => {
    if (!preview) return;
    const ids = preview.rows.filter((r) => on[r.row_id]).map((r) => r.row_id);
    if (!ids.length) return flash("No hay movimientos seleccionados");
    setBusy(true);
    const n = await confirmImport(preview.import_id, ids, cats);
    setBusy(false);
    if (n === null) return;
    onClose();
    flash(`Importaste ${n} movimientos de ${card?.name ?? "la tarjeta"}`, "gasto");
  };

  const selected = preview?.rows.filter((r) => on[r.row_id]) ?? [];
  const dups = preview?.rows.filter((r) => r.duplicate).length ?? 0;
  const cuotas = preview?.rows.filter((r) => r.installment).length ?? 0;
  const bankName = preview?.bank ? BANK_BY_ID[preview.bank as BankId]?.name : null;
  const totalArs = selected.filter((r) => r.currency === "ARS").reduce((s, r) => s + Number(r.amount), 0);
  const totalUsd = selected.filter((r) => r.currency === "USD").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 33 }}>
      <div className={`${t.sheet} ${m.sheet}`} role="dialog" aria-modal="true" aria-label="Importar resumen" onClick={(e) => e.stopPropagation()}>
        <div className={m.head}>
          <div>
            <strong>Importar resumen</strong>
            <span>
              {preview
                ? `${bankName ? `Resumen de ${bankName} · ` : ""}${preview.rows.length} movimientos${dups ? ` · ${dups} ya cargados` : ""}${cuotas ? ` · ${cuotas} ${cuotas === 1 ? "cuota" : "cuotas"} en seguimiento` : ""}`
                : "Subí el PDF del resumen y revisá los movimientos antes de importarlos."}
            </span>
          </div>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
            close
          </button>
        </div>

        {!preview ? (
          <>
            {cards.length ? (
              <label className={m.field}>
                Tarjeta
                <select className={m.input} value={cardId} onChange={(e) => setCardId(e.target.value)}>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.last4 ? ` · ${c.last4}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className={m.note}>Primero agregá la tarjeta en Tarjetas y deudas.</span>
            )}
            <button
              className={m.drop}
              data-drag={drag}
              disabled={busy || !cards.length}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                upload(e.dataTransfer.files[0]);
              }}
            >
              <span className="material-symbols-rounded">{busy ? "hourglass_top" : "upload_file"}</span>
              <strong>{busy ? "Leyendo el resumen…" : "Elegí el PDF o arrastralo acá"}</strong>
              <small>El resumen que descargás del home banking. Detectamos impuestos, percepciones y cuotas.</small>
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => upload(e.target.files?.[0])} aria-label="Archivo PDF del resumen" />
          </>
        ) : (
          <>
            <div className={m.rows}>
              {preview.rows.map((r) => {
                const badge = r.duplicate ? { label: "Ya cargado", color: "var(--amb)" } : r.installment ? { label: `Cuota ${r.installment.n}/${r.installment.of}`, color: "var(--acc2)" } : KIND_BADGE[r.kind];
                const disabled = r.kind === "payment";
                return (
                  <label key={r.row_id} className={m.row} style={{ opacity: on[r.row_id] ? 1 : 0.55 }}>
                    <input type="checkbox" checked={!!on[r.row_id]} disabled={disabled} onChange={(e) => setOn({ ...on, [r.row_id]: e.target.checked })} />
                    <span className={m.rowMain}>
                      <span className={m.rowTop}>
                        <strong>{r.description}</strong>
                        {badge && (
                          <em style={{ color: badge.color, background: `color-mix(in oklch, ${badge.color} 16%, transparent)` }}>{badge.label}</em>
                        )}
                      </span>
                      <span className={m.rowSub}>
                        {Number(r.date.slice(8))} {MONTH_SHORT[Number(r.date.slice(5, 7)) - 1]}
                        {!disabled && (
                          <select value={cats[r.row_id]} onChange={(e) => setCats({ ...cats, [r.row_id]: e.target.value })} onClick={(e) => e.preventDefault()} aria-label={`Categoría de ${r.description}`}>
                            {pickableCategories("out").map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {!disabled && r.learned && cats[r.row_id] === r.suggested_category && (
                          <span className={m.learned} title="La elegiste antes para este comercio">
                            ✓ aprendida
                          </span>
                        )}
                      </span>
                    </span>
                    <b className={m.amount}>{formatMoney(Number(r.amount), r.currency, { decimals: true })}</b>
                  </label>
                );
              })}
            </div>
            {(preview.balance_ars || preview.min_payment) && (
              <span className={m.note}>
                Al importar actualizamos {card?.name}: {preview.balance_ars ? `saldo ${formatMoney(Number(preview.balance_ars), "ARS")}` : ""}
                {preview.min_payment ? ` · mínimo ${formatMoney(Number(preview.min_payment), "ARS")}` : ""}
                {preview.due_date ? ` · vence el ${Number(preview.due_date.slice(8))}` : ""}.
              </span>
            )}
            <div className={m.foot}>
              <span>
                {selected.length} seleccionados · {formatMoney(totalArs, "ARS")}
                {totalUsd ? ` + ${formatMoney(totalUsd, "USD", { decimals: true })}` : ""}
              </span>
              <button className={t.primary} style={{ flex: "none", padding: "0 20px" }} onClick={confirm} disabled={busy}>
                {busy ? "Importando…" : `Importar ${selected.length}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
