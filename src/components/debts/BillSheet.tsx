"use client";

import { useEffect, useState } from "react";
import { CATEGORY_BY_ID, pickableCategories } from "@/lib/categories";
import { guessCategory } from "@/lib/merchants";
import { maskAmountEvent, parseAmount, toDecimal, toInput, type Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { CatIcon, sourceKey, sourceOptions, splitSource } from "@/components/tx/parts";
import t from "@/components/tx/tx.module.css";
import d from "./debts.module.css";
import { dayOk, digits } from "@/lib/inputs";


/** Alta o edición de un gasto fijo (id null = nuevo). */
export function BillSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { flash } = useShell();
  const { bills, accounts, cards, saveBill, deleteBill } = useData();
  const bill = id ? bills.find((b) => b.id === id) : null;

  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? toInput(bill.amount) : "");
  const [currency, setCurrency] = useState<Currency>(bill?.currency ?? "ARS");
  const [due, setDue] = useState(bill ? String(bill.due_day) : "10");
  const [category, setCategory] = useState(bill?.category_id ?? "servicios");
  const [catTouched, setCatTouched] = useState(!!bill);
  const [autoDebit, setAutoDebit] = useState(bill?.auto_debit ?? false);
  const [source, setSource] = useState<string | null>(bill ? sourceKey(bill) : null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const options = sourceOptions(accounts, cards, "out", currency);

  const changeName = (v: string) => {
    setErr("");
    setName(v);
    if (!catTouched) {
      const g = guessCategory(v);
      setCategory(g && CATEGORY_BY_ID[g]?.type === "out" ? g : "servicios");
    }
  };

  const save = async () => {
    if (!name.trim()) return setErr("Poné un nombre al gasto fijo");
    if (!parseAmount(amount)) return setErr("Poné el monto");
    if (!dayOk(due)) return setErr("El día va de 1 a 31");
    setBusy(true);
    const ok = await saveBill(id, {
      name: name.trim(),
      amount: toDecimal(parseAmount(amount)),
      currency,
      due_day: Number(due),
      category_id: category,
      auto_debit: autoDebit,
      ...splitSource(options.some((o) => o.key === source) ? source : null),
    });
    setBusy(false);
    if (ok) {
      flash(id ? "Gasto fijo actualizado" : "Gasto fijo agregado");
      onClose();
    }
  };

  const remove = async () => {
    if (!id) return;
    if (!confirmDel) return setConfirmDel(true);
    setBusy(true);
    const ok = await deleteBill(id);
    setBusy(false);
    if (ok) {
      flash("Gasto fijo eliminado");
      onClose();
    }
  };

  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 32 }}>
      <div className={`${t.sheet} ${t.detail}`} role="dialog" aria-modal="true" aria-label={id ? `Gasto fijo ${bill?.name}` : "Nuevo gasto fijo"} onClick={(e) => e.stopPropagation()}>
        <div className={t.glow} />
        <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
          close
        </button>
        <CatIcon id={category} size={64} />
        <input className={t.descInline} value={name} onChange={(e) => changeName(e.target.value)} placeholder="Ej. Edenor (luz), Alquiler, Netflix" aria-label="Nombre" maxLength={80} autoFocus={!id} />
        <div className={t.detailAmount}>
          <button className={t.curBtn} onClick={() => setCurrency((c) => (c === "ARS" ? "USD" : "ARS"))} title="Cambiar moneda">
            {currency === "USD" ? "US$" : "$"}
          </button>
          <input
            className={t.amount}
            value={amount}
            inputMode="decimal"
            placeholder="0"
            aria-label="Monto"
            onChange={(e) => {
              setErr("");
              setAmount(maskAmountEvent(e));
            }}
          />
        </div>
        <div className={d.fields}>
          <label className={d.field}>
            Vence (día)
            <input
              className={d.input}
              value={due}
              onChange={(e) => {
                setErr("");
                setDue(digits(e.target.value, 2));
              }}
              inputMode="numeric"
            />
          </label>
          <label className={d.field}>
            Categoría
            <select
              className={d.input}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCatTouched(true);
              }}
            >
              {pickableCategories("out").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {options.length > 0 && (
            <label className={`${d.field} ${d.full}`}>
              Se paga con
              <select className={d.input} value={source && options.some((o) => o.key === source) ? source : ""} onChange={(e) => setSource(e.target.value || null)}>
                <option value="">Sin definir</option>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={`${d.check} ${d.full}`}>
            <input type="checkbox" checked={autoDebit} onChange={(e) => setAutoDebit(e.target.checked)} />
            Débito automático
          </label>
        </div>
        {err && (
          <div className={t.error} role="alert">
            {err}
          </div>
        )}
        <div className={t.actions}>
          {id && (
            <button className={t.delete} data-confirm={confirmDel} onClick={remove} disabled={busy}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                delete
              </span>
              {confirmDel ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          <button className={t.primary} onClick={save} disabled={busy}>
            {busy ? "Guardando…" : id ? "Guardar cambios" : "Agregar gasto fijo"}
          </button>
        </div>
      </div>
    </div>
  );
}
