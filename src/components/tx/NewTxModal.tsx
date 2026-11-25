"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { VIEWS } from "@/lib/nav";
import { DEFAULT_CATEGORY, catColor, catTint, pickableCategories } from "@/lib/categories";
import { guessCategory } from "@/lib/merchants";
import { formatMoney, maskAmountEvent, maskAmountInput, parseAmount, toDecimal, type Currency } from "@/lib/money";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import { sourceOptions, splitSource, todayAR } from "./parts";
import { Logo } from "@/components/shell/Logo";
import { useIsMobile } from "./useIsMobile";
import s from "./tx.module.css";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

export function NewTxModal() {
  const { newTxOpen } = useShell();
  // Se monta de cero cada vez que se abre, así arranca con el formulario vacío.
  return newTxOpen ? <Form /> : null;
}

function Form() {
  const router = useRouter();
  const { closeNewTx, flash, setAccountFormOpen, user } = useShell();
  const { accounts, cards, people, createTx, addShared } = useData();
  const isMobile = useIsMobile();
  const amountRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(DEFAULT_CATEGORY.out);
  const [catTouched, setCatTouched] = useState(false);
  const [date, setDate] = useState(todayAR);
  const [recurring, setRecurring] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [split, setSplit] = useState<string[]>([]);
  const [cuotas, setCuotas] = useState(1);

  useEffect(() => {
    if (!isMobile) amountRef.current?.focus();
  }, [isMobile]);

  const options = sourceOptions(accounts, cards, type, currency);
  const value = parseAmount(amount);

  // El sueldo entra, de entrada, en la cuenta donde te lo depositan.
  const salaryAcc = accounts.find((a) => a.id === user.salary_account_id && a.currency === currency);
  const changeType = (t: "in" | "out") => {
    setType(t);
    setCat(DEFAULT_CATEGORY[t]);
    setCatTouched(false);
    if (t === "in" && (!source || source.startsWith("card:"))) setSource(salaryAcc?.id ?? null);
    else if (t === "in" && source?.startsWith("card:")) setSource(null);
  };

  const changeDesc = (v: string) => {
    setDesc(v);
    // El comercio sugiere la categoría hasta que el usuario elige una a mano.
    if (!catTouched) {
      const g = guessCategory(v);
      if (g && pickableCategories(type).some((c) => c.id === g)) setCat(g);
    }
  };

  const toggleCurrency = () => {
    const next = currency === "ARS" ? "USD" : "ARS";
    setCurrency(next);
    if (source && !source.startsWith("card:") && !sourceOptions(accounts, [], type, next).some((o) => o.key === source)) setSource(null);
  };

  const press = (k: string) => {
    if (k === "⌫") return setAmount((a) => maskAmountInput(a.slice(0, -1)));
    setAmount((a) => maskAmountInput(a + k));
  };

  const save = async () => {
    if (!value) {
      setErr("Ingresá un monto");
      return amountRef.current?.focus();
    }
    // Dividido con contactos: se guarda como gasto compartido (tu parte va a tus gastos).
    if (type === "out" && split.length) {
      const share = value / (split.length + 1);
      closeNewTx();
      const ok = await addShared({
        description: desc.trim() || "Gasto compartido",
        date,
        category_id: cat,
        total: toDecimal(value),
        currency,
        paid_by: "me",
        participants: ["me", ...split],
        ...splitSource(source),
      });
      if (ok) flash(`Guardamos tu parte: ${formatMoney(share, currency)}`, "gasto");
      return;
    }
    closeNewTx();
    const inCuotas = source?.startsWith("card:") && currency === "ARS" && cuotas > 1;
    flash(
      type === "in" ? "Ingreso guardado" : inCuotas ? `Compra en ${cuotas} cuotas de ${formatMoney(value / cuotas, "ARS")}` : "Gasto guardado",
      type === "in" ? "ingreso" : "gasto",
    );
    await createTx({
      type,
      date,
      description: desc.trim(),
      category_id: cat,
      amount: toDecimal(value),
      currency,
      recurring,
      ...splitSource(source),
      installments: source?.startsWith("card:") && currency === "ARS" ? cuotas : 1,
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Como en el prototipo, Enter guarda desde cualquier parte del modal (Espacio sigue activando botones).
    if (e.key === "Enter" && !(e.target instanceof HTMLElement && e.target.title.startsWith("Cerrar"))) {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div className={s.backdrop} onClick={closeNewTx}>
      <div
        className={s.sheet}
        data-type={type}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo movimiento"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={s.glow} />
        <div className={s.top}>
          <div className={s.typeSeg} role="group" aria-label="Tipo">
            {(
              [
                ["out", "Gasto"],
                ["in", "Ingreso"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} data-v={v} aria-pressed={type === v} onClick={() => changeType(v)}>
                {l}
              </button>
            ))}
          </div>
          <button className={`${s.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={closeNewTx}>
            close
          </button>
        </div>

        <div className={s.amountRow}>
          <button className={s.curBtn} onClick={toggleCurrency} title="Cambiar moneda">
            {currency === "USD" ? "US$" : "$"}
          </button>
          <input
            ref={amountRef}
            className={s.amount}
            value={amount}
            readOnly={isMobile}
            inputMode="decimal"
            placeholder="0"
            aria-label="Monto"
            onChange={(e) => {
              setAmount(maskAmountEvent(e));
              setErr("");
            }}
          />
        </div>
        {err && (
          <div className={s.error} role="alert">
            {err}
          </div>
        )}

        <input
          className={s.desc}
          value={desc}
          onChange={(e) => changeDesc(e.target.value)}
          placeholder="Descripción (ej. Coto, Sueldo, Uber)"
          aria-label="Descripción"
          maxLength={120}
        />

        <div className={s.cats} role="group" aria-label="Categoría">
          {pickableCategories(type).map((c) => (
            <button
              key={c.id}
              className={s.cat}
              aria-pressed={cat === c.id}
              onClick={() => {
                setCat(c.id);
                setCatTouched(true);
                if (c.id === "sueldo" && !source && salaryAcc) setSource(salaryAcc.id);
              }}
            >
              <span className={`${s.catIcon} material-symbols-rounded`} style={{ background: catTint(c.id), color: catColor(c.id) }}>
                {c.icon}
              </span>
              <span className={s.catName}>{c.name}</span>
            </button>
          ))}
        </div>

        {options.length === 0 && (
          <button
            className={s.addSource}
            onClick={() => {
              closeNewTx();
              setAccountFormOpen(true);
              router.push(VIEWS.acc.href);
            }}
          >
            <span className="material-symbols-rounded">add_card</span>
            {accounts.length ? `No tenés cuentas en ${currency === "USD" ? "dólares" : "pesos"}. Agregá una` : "Agregá tus cuentas para saber de dónde sale cada gasto"}
          </button>
        )}

        {options.length > 0 && (
          <div className={s.group}>
            <span className={s.groupLabel}>{type === "in" ? "Entra en" : "Pagado con"}</span>
            {options.some((o) => !o.card) && (
              <div className={s.chips}>
                {options
                  .filter((o) => !o.card)
                  .map((o) => (
                    <button key={o.key} className={s.chip} aria-pressed={source === o.key} onClick={() => setSource(source === o.key ? null : o.key)}>
                      <Logo domain={o.domain} icon={o.icon} size={22} iconBg="transparent" iconColor="currentColor" />
                      {o.label}
                    </button>
                  ))}
              </div>
            )}
            {options.some((o) => o.card) && (
              <>
                <span className={s.groupLabel} style={{ marginTop: 4 }}>
                  Tarjeta de crédito
                </span>
                <div className={s.chips}>
                  {options
                    .filter((o) => o.card)
                    .map((o) => (
                      <button
                        key={o.key}
                        className={s.chip}
                        aria-pressed={source === o.key}
                        onClick={() => {
                          setSource(source === o.key ? null : o.key);
                          setCuotas(1);
                        }}
                      >
                        <Logo domain={o.domain} icon="credit_card" size={22} iconBg="transparent" iconColor="currentColor" />
                        {o.label}
                      </button>
                    ))}
                </div>
              </>
            )}
            {source?.startsWith("card:") &&
              (currency === "ARS" ? (
                <div className={s.cuotas}>
                  <span>Cuotas</span>
                  <div role="group" aria-label="Cuotas">
                    {[1, 3, 6, 9, 12, 18].map((n) => (
                      <button key={n} aria-pressed={cuotas === n} onClick={() => setCuotas(n)}>
                        {n === 1 ? "1 pago" : n}
                      </button>
                    ))}
                  </div>
                  {cuotas > 1 && value > 0 && <small>{formatMoney(value / cuotas, "ARS")} por mes · cuenta como gasto la cuota de cada mes</small>}
                </div>
              ) : (
                <small className={s.cuotasNote}>Las compras en dólares con tarjeta van en un pago.</small>
              ))}
          </div>
        )}

        {type === "out" && people.length > 0 && (
          <div className={s.group}>
            <div className={s.splitHead}>
              <span className={s.groupLabel}>Dividir con</span>
              {split.length > 0 && value > 0 && (
                <span className={s.splitHint}>Tu parte: {formatMoney(value / (split.length + 1), currency)} · el resto te lo deben</span>
              )}
            </div>
            <div className={s.chips} style={{ flexWrap: "wrap" }}>
              {people.map((p) => {
                const on = split.includes(p.id);
                return (
                  <button key={p.id} className={s.chip} aria-pressed={on} onClick={() => setSplit(on ? split.filter((x) => x !== p.id) : [...split, p.id])}>
                    <span className={s.personDot}>{p.name[0]?.toUpperCase()}</span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={s.keypad}>
          {KEYS.map((k) => (
            <button key={k} onClick={() => press(k)} aria-label={k === "⌫" ? "Borrar" : k}>
              {k}
            </button>
          ))}
        </div>

        <div className={s.extras}>
          <input
            type="date"
            className={s.pillInput}
            value={date}
            max={todayAR()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Fecha"
          />
          <button className={s.pillBtn} aria-pressed={recurring} onClick={() => setRecurring((r) => !r)}>
            ↻ Repetir cada mes
          </button>
        </div>

        <button className={s.save} data-empty={!value} onClick={save}>
          Guardar<span className={s.kbd}>Enter</span>
        </button>
      </div>
    </div>
  );
}
