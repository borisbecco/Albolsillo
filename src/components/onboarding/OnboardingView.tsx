"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { detectBank, detectNetwork } from "@/lib/banks";
import { CATEGORY_BY_ID, catColor, catTint } from "@/lib/categories";
import { guessCategory } from "@/lib/merchants";
import { maskAmountEvent, parseAmount, toDecimal, toInput, type Currency } from "@/lib/money";
import { currentMonth } from "@/lib/month";
import type { UserDto } from "@/lib/auth/session";
import { CardFace } from "@/components/cards/CardFace";
import { DepositPicker, depositPayload, type Deposit } from "./DepositPicker";
import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import o from "./onboarding.module.css";
import { dayOk, digits } from "@/lib/inputs";

const STEPS = ["Ingresos", "Tarjetas", "Gastos fijos", "Estrategia"];
const TITLES = ["¿Cuánto cobrás por mes?", "Tus tarjetas de crédito", "Gastos fijos del mes", "¿Cómo querés pagar tus deudas?"];
const SUBS = [
  "Con esto calculamos cuánto te queda libre cada mes.",
  "Saldo del último resumen, pago mínimo, vencimiento y tasa. Lo encontrás en el resumen de cada tarjeta.",
  "Alquiler, servicios, impuestos y suscripciones. Te avisamos antes de cada vencimiento.",
  "Elegí cómo repartir lo que sobra entre tus tarjetas. Lo podés cambiar cuando quieras.",
];
const STRATEGIES: [UserDto["pay_strategy"], string, string][] = [
  ["intereses", "Evitar intereses", "Pagá completa la tarjeta que vence primero."],
  ["avalancha", "Avalancha", "Mayor tasa primero. Minimiza el interés total."],
  ["bola", "Bola de nieve", "Saldo más chico primero. Cerrás deudas antes."],
];

type CardRow = { key: string; id?: string; name: string; balance: string; min: string; due: string; tna: string; last4: string };
type BillRow = { key: string; id?: string; name: string; amount: string; due: string; category: string; currency: "ARS" | "USD" };

const fromDec = (v: string | null) => (v && Number(v) ? toInput(v) : "");
const newKey = () => crypto.randomUUID();

/** Categoría de un gasto fijo por su nombre (solo de gastos fijos; si no, Servicios). */
function billCategory(name: string) {
  const g = guessCategory(name);
  return g && CATEGORY_BY_ID[g]?.type === "out" ? g : "servicios";
}

export function OnboardingView() {
  const router = useRouter();
  const { user, flash, onboardingStep, setOnboardingStep } = useShell();
  const { cards: savedCards, bills: savedBills, accounts, saveOnboarding } = useData();
  const redo = !!user.onboarded_at;

  // Arranca en el paso pedido (p. ej. "Sumá tarjetas" abre Tarjetas) y lo deja en 0 para la próxima.
  const [step, setStep] = useState(onboardingStep);
  useEffect(() => setOnboardingStep(0), [setOnboardingStep]);
  const [salary, setSalary] = useState(fromDec(user.salary));
  const [payday, setPayday] = useState(user.payday ? String(user.payday) : "");
  const [usd, setUsd] = useState(fromDec(user.usd_income));
  const [salaryCur, setSalaryCur] = useState<Currency>(user.salary_currency ?? "ARS");
  const [otherCur, setOtherCur] = useState<Currency>(user.other_income_currency ?? "USD");
  // Dónde entra cada ingreso: una cuenta tuya o un banco nuevo (se crea al guardar).
  const startAcc = (id: string | null | undefined): Deposit => ({ acc: id && accounts.some((a) => a.id === id) ? id : null, bank: "" });
  const [salaryDep, setSalaryDep] = useState<Deposit>(() => startAcc(user.salary_account_id));
  const [otherDep, setOtherDep] = useState<Deposit>(() => startAcc(user.other_income_account_id));
  const [otherDay, setOtherDay] = useState(user.other_income_day ? String(user.other_income_day) : "");
  const [cards, setCards] = useState<CardRow[]>(() =>
    savedCards.map((c) => ({
      key: c.id,
      id: c.id,
      name: c.name,
      balance: fromDec(c.balance),
      min: fromDec(c.min_payment),
      due: String(c.due_day),
      tna: String(Number(c.tna)),
      last4: c.last4 ?? "",
    })),
  );
  const [bills, setBills] = useState<BillRow[]>(() =>
    savedBills.map((b) => ({ key: b.id, id: b.id, name: b.name, amount: fromDec(b.amount), due: String(b.due_day), category: b.category_id, currency: b.currency })),
  );
  const [strategy, setStrategy] = useState(user.pay_strategy);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const month = currentMonth();

  // Cualquier cambio borra el error mostrado.
  const edit =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setErr("");
      fn(v);
    };
  const setCard = edit((a: [string, Partial<CardRow>]) => setCards((l) => l.map((c) => (c.key === a[0] ? { ...c, ...a[1] } : c))));
  const setBill = edit((a: [string, Partial<BillRow>]) => setBills((l) => l.map((b) => (b.key === a[0] ? { ...b, ...a[1] } : b))));

  /** Valida el paso actual; devuelve el mensaje de error o "". */
  function validate(s: number): string {
    if (s === 0 && payday && !dayOk(payday)) return "El día de cobro va de 1 a 31";
    if (s === 0 && otherDay && !dayOk(otherDay)) return "El día de los otros ingresos va de 1 a 31";
    if (s === 1) {
      for (const c of cards) {
        if (!c.name.trim()) return "Poné un nombre a cada tarjeta (ej. Visa Galicia)";
        if (!dayOk(c.due)) return `El vencimiento de ${c.name} va de 1 a 31`;
        if (c.last4 && c.last4.length !== 4) return `Los últimos 4 de ${c.name} son 4 números`;
      }
    }
    if (s === 2) {
      for (const b of bills.filter((x) => x.name.trim())) {
        if (!parseAmount(b.amount)) return `Poné el monto de ${b.name}`;
        if (!dayOk(b.due)) return `El día de ${b.name} va de 1 a 31`;
      }
    }
    return "";
  }

  const go = (to: number) => {
    if (to > step) {
      for (let s = step; s < to; s++) {
        const e = validate(s);
        if (e) {
          setStep(s);
          return setErr(e);
        }
      }
    }
    setErr("");
    setStep(to);
  };

  const finish = async () => {
    for (let s = 0; s < 4; s++) {
      const e = validate(s);
      if (e) {
        setStep(s);
        return setErr(e);
      }
    }
    setBusy(true);
    const ok = await saveOnboarding({
      salary: parseAmount(salary) ? toDecimal(parseAmount(salary)) : null,
      payday: payday ? Number(payday) : null,
      usd_income: parseAmount(usd) ? toDecimal(parseAmount(usd)) : null,
      salary_currency: salaryCur,
      other_income_currency: otherCur,
      ...(({ account_id, bank }) => ({ salary_account_id: account_id, salary_bank: bank }))(depositPayload(salaryDep, accounts, salaryCur)),
      ...(parseAmount(usd)
        ? (({ account_id, bank }) => ({ other_income_account_id: account_id, other_income_bank: bank }))(depositPayload(otherDep, accounts, otherCur))
        : { other_income_account_id: null, other_income_bank: null }),
      other_income_day: parseAmount(usd) && otherDay ? Number(otherDay) : null,
      strategy,
      cards: cards.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        balance: toDecimal(parseAmount(c.balance)),
        min_payment: toDecimal(parseAmount(c.min)),
        due_day: Number(c.due),
        tna: String(Math.min(999, parseAmount(c.tna))),
        last4: c.last4 || null,
      })),
      bills: bills
        .filter((b) => b.name.trim())
        .map((b) => ({
          id: b.id,
          name: b.name.trim(),
          amount: toDecimal(parseAmount(b.amount)),
          currency: b.currency,
          due_day: Number(b.due),
          category_id: b.category,
        })),
    });
    setBusy(false);
    if (ok) {
      flash("Tu plan del mes está listo. Bolsi te banca.", "meta");
      startTourAfter(redo);
      router.replace("/");
    }
  };

  const skip = async () => {
    if (!redo && !(await saveOnboarding({ skipped: true }))) return;
    startTourAfter(redo);
    router.replace("/");
  };

  return (
    <main className={o.page}>
      <div className={o.inner}>
        <div className={o.top}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal-oscuro.svg" alt="Albolsillo" className={`${o.logo} only-dark`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-horizontal-claro.svg" alt="Albolsillo" className={`${o.logo} only-light`} />
          <button className={o.skip} onClick={skip}>
            {redo ? "Volver sin guardar" : "Saltar por ahora"}
          </button>
        </div>

        <nav className={o.steps} aria-label="Pasos">
          {STEPS.map((label, i) => (
            <button key={label} className={o.step} data-done={i <= step} aria-current={i === step ? "step" : undefined} onClick={() => go(i)}>
              <span className={o.bar} />
              {label}
            </button>
          ))}
        </nav>

        <div>
          <h1 className={o.title}>{TITLES[step]}</h1>
          <p className={o.sub}>{SUBS[step]}</p>
        </div>

        <div className={o.body} key={step}>
          {step === 0 && (
            <div className={o.incomeGrid}>
              <label className={o.field}>
                <span className={o.fieldHead}>
                  Sueldo mensual neto
                  <CurSeg value={salaryCur} onChange={setSalaryCur} />
                </span>
                <input className={o.big} value={salary} onChange={(e) => edit(setSalary)(maskAmountEvent(e))} inputMode="decimal" placeholder="2.400.000" autoFocus />
              </label>
              <label className={o.field}>
                <span className={o.fieldHead}>Día de cobro</span>
                <input className={o.big} value={payday} onChange={(e) => edit(setPayday)(digits(e.target.value, 2))} inputMode="numeric" placeholder="1" />
              </label>
              <DepositPicker
                label="¿Dónde te depositan el sueldo?"
                accounts={accounts}
                currency={salaryCur}
                value={salaryDep}
                onChange={setSalaryDep}
                hint="El día de cobro te proponemos sumarlo a esa cuenta con un toque."
              />
              <label className={o.field}>
                <span className={o.fieldHead}>
                  Otros ingresos mensuales
                  <CurSeg value={otherCur} onChange={setOtherCur} />
                </span>
                <input className={o.big} value={usd} onChange={(e) => edit(setUsd)(maskAmountEvent(e))} inputMode="decimal" placeholder="0" />
              </label>
              <label className={o.field}>
                <span className={o.fieldHead}>Día en que entran</span>
                <input
                  className={o.big}
                  value={otherDay}
                  onChange={(e) => edit(setOtherDay)(digits(e.target.value, 2))}
                  inputMode="numeric"
                  placeholder={payday || "1"}
                  disabled={!parseAmount(usd)}
                />
              </label>
              {parseAmount(usd) > 0 && (
                <DepositPicker
                  label="¿Dónde los recibís?"
                  accounts={accounts}
                  currency={otherCur}
                  value={otherDep}
                  onChange={setOtherDep}
                  hint="Ese día te proponemos sumarlos a esa cuenta con un toque."
                />
              )}
            </div>
          )}

          {step === 1 && (
            <div className={o.list}>
              {cards.map((c, i) => (
                <div key={c.key} className={o.cardRow}>
                  <div className={o.preview}>
                    <CardFace
                      name={c.name}
                      bank={detectBank(c.name)}
                      network={detectNetwork(c.name)}
                      balance={parseAmount(c.balance)}
                      last4={c.last4}
                      dueDay={dayOk(c.due) ? Number(c.due) : null}
                      index={i}
                      month={month}
                    />
                  </div>
                  <div className={o.cardFields}>
                    <div className={o.nameRow}>
                      <input className={o.cardName} value={c.name} onChange={(e) => setCard([c.key, { name: e.target.value }])} placeholder="Ej. Visa Galicia" aria-label="Nombre de la tarjeta" maxLength={60} />
                      <button className={`${o.del} material-symbols-rounded`} title="Quitar" onClick={() => setCards((l) => l.filter((x) => x.key !== c.key))}>
                        delete
                      </button>
                    </div>
                    <div className={o.pair}>
                      <label className={o.field}>
                        Saldo a pagar
                        <input className={o.small} value={c.balance} onChange={(e) => setCard([c.key, { balance: maskAmountEvent(e) }])} inputMode="decimal" placeholder="0" />
                      </label>
                      <label className={o.field}>
                        Pago mínimo
                        <input className={o.small} value={c.min} onChange={(e) => setCard([c.key, { min: maskAmountEvent(e) }])} inputMode="decimal" placeholder="0" />
                      </label>
                      <label className={o.field}>
                        Vence (día)
                        <input className={o.small} value={c.due} onChange={(e) => setCard([c.key, { due: digits(e.target.value, 2) }])} inputMode="numeric" />
                      </label>
                      <label className={o.field}>
                        TNA %
                        <input className={o.small} value={c.tna} onChange={(e) => setCard([c.key, { tna: maskAmountEvent(e) }])} inputMode="decimal" />
                      </label>
                      <label className={o.field}>
                        Últimos 4
                        <input className={o.small} value={c.last4} onChange={(e) => setCard([c.key, { last4: digits(e.target.value, 4) }])} inputMode="numeric" placeholder="0000" />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <button
                className={o.addDashed}
                onClick={() => setCards((l) => [...l, { key: newKey(), name: "", balance: "", min: "", due: "20", tna: "110", last4: "" }])}
              >
                <span className="material-symbols-rounded">add</span>
                Agregar tarjeta
              </button>
            </div>
          )}

          {step === 2 && (
            <div className={o.billsBox}>
              {bills.map((b) => (
                <div key={b.key} className={o.billRow}>
                  <span
                    className="material-symbols-rounded"
                    style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: catTint(b.category), color: catColor(b.category), fontSize: 20, flex: "none" }}
                    aria-hidden
                  >
                    {CATEGORY_BY_ID[b.category]?.icon}
                  </span>
                  <input
                    className={o.billName}
                    value={b.name}
                    onChange={(e) => setBill([b.key, { name: e.target.value, ...(!b.id && { category: billCategory(e.target.value) }) }])}
                    placeholder="Ej. Edenor (luz), Alquiler, Netflix"
                    aria-label="Nombre del gasto fijo"
                    maxLength={80}
                  />
                  <span className={o.billMeta}>
                    {b.currency === "USD" ? "US$" : "$"}
                    <input
                      className={o.billInput}
                      style={{ width: 96 }}
                      value={b.amount}
                      onChange={(e) => setBill([b.key, { amount: maskAmountEvent(e) }])}
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`Monto de ${b.name || "gasto fijo"}`}
                    />
                    día
                    <input
                      className={o.billInput}
                      style={{ width: 42, textAlign: "center" }}
                      value={b.due}
                      onChange={(e) => setBill([b.key, { due: digits(e.target.value, 2) }])}
                      inputMode="numeric"
                      aria-label={`Día de ${b.name || "gasto fijo"}`}
                    />
                  </span>
                  <button className={`${o.billDel} material-symbols-rounded`} title="Quitar" onClick={() => setBills((l) => l.filter((x) => x.key !== b.key))}>
                    close
                  </button>
                </div>
              ))}
              <button className={o.addRow} onClick={() => setBills((l) => [...l, { key: newKey(), name: "", amount: "", due: "10", category: "servicios", currency: "ARS" }])}>
                <span className="material-symbols-rounded">add</span>
                Agregar gasto fijo
              </button>
            </div>
          )}

          {step === 3 && (
            <div className={o.list} role="radiogroup" aria-label="Estrategia de pago">
              {STRATEGIES.map(([v, label, desc]) => (
                <button key={v} className={o.strategy} role="radio" aria-checked={strategy === v} onClick={() => setStrategy(v)}>
                  <span className={o.strategyHead}>
                    <span className={o.radio} />
                    {label}
                  </span>
                  <span className={o.strategyDesc}>{desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {err && (
          <div className={o.error} role="alert">
            {err}
          </div>
        )}

        <div className={o.footer}>
          <button className={o.back} style={{ visibility: step > 0 ? "visible" : "hidden" }} onClick={() => go(step - 1)}>
            Atrás
          </button>
          {step < 3 ? (
            <button className={o.next} onClick={() => go(step + 1)}>
              Siguiente<span className="material-symbols-rounded">arrow_forward</span>
            </button>
          ) : (
            <button className={o.next} onClick={finish} disabled={busy}>
              {busy ? "Armando…" : "Armar mi plan"}
              <span className="material-symbols-rounded">check</span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/** Selector $ / US$ junto al título del campo. */
function CurSeg({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <span className={o.curSeg} role="group" aria-label="Moneda">
      {(
        [
          ["ARS", "$"],
          ["USD", "US$"],
        ] as const
      ).map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={(e) => {
            e.preventDefault();
            onChange(v);
          }}
        >
          {l}
        </button>
      ))}
    </span>
  );
}

/** Al terminar la configuración inicial (no al rehacerla), Inicio arranca el recorrido guiado. */
function startTourAfter(redo: boolean) {
  if (redo) return;
  try {
    sessionStorage.setItem("ab-start-tour", "1");
  } catch {}
}
