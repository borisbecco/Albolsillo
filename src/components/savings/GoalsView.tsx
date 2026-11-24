"use client";

import { useState, type FormEvent } from "react";
import { formatMoney, maskAmountInput, parseAmount, toDecimal, type Currency } from "@/lib/money";
import { MONTH_FULL, addMonths, currentMonth } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import type { GoalDto } from "@/lib/savings";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import s from "./savings.module.css";

const ICONS = ["savings", "flight", "laptop_mac", "home", "directions_car", "school", "shield", "celebration"];
const HUES = [250, 160, 40, 300, 200, 350];
const RING = 326.7;

/** Meses que faltan hasta el mes objetivo (mínimo 1). */
function monthsLeft(due: string | null) {
  if (!due) return 12;
  const [y, m] = due.split("-").map(Number);
  const [cy, cm] = currentMonth().split("-").map(Number);
  return Math.max(1, y * 12 + m - (cy * 12 + cm));
}

export function GoalsView() {
  const { user, forced } = useShell();
  const { goals, toDisplay } = useData();

  if (!goals.length && !forced.goals) return <EmptyState copy={EMPTY.goals!} />;

  const rows = goals.map((g) => {
    const left = Math.max(0, Number(g.target) - Number(g.saved));
    const ml = monthsLeft(g.due_month);
    return { g, left, ml, need: left / ml };
  });
  const cur = user.display_currency;
  const sumOf = (f: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + toDisplay(f(r), r.g.currency), 0);

  return (
    <div className={s.wrap}>
      {goals.length > 0 && (
        <div className={s.kpis}>
          <div className={s.kpi}>
            <span>Ahorrado en metas</span>
            <strong>{formatMoney(sumOf((r) => Number(r.g.saved)), cur)}</strong>
          </div>
          <div className={s.kpi}>
            <span>Objetivo total</span>
            <strong>{formatMoney(sumOf((r) => Number(r.g.target)), cur)}</strong>
          </div>
          <div className={s.kpi}>
            <span>Aporte mensual sugerido</span>
            <strong style={{ color: "var(--acc)" }}>{formatMoney(sumOf((r) => r.need), cur)}</strong>
          </div>
        </div>
      )}
      <div className={s.goals}>
        {rows.map((r, i) => (
          <GoalCard key={r.g.id} goal={r.g} hue={HUES[i % HUES.length]} monthsLeft={r.ml} need={r.need} left={r.left} />
        ))}
        <NewGoal count={goals.length} />
      </div>
    </div>
  );
}

function GoalCard({ goal, hue, monthsLeft: ml, need, left }: { goal: GoalDto; hue: number; monthsLeft: number; need: number; left: number }) {
  const { flash } = useShell();
  const { contribute, deleteGoal } = useData();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const p = Number(goal.target) ? Number(goal.saved) / Number(goal.target) : 0;
  const done = p >= 1;
  const col = done ? "var(--pos)" : `oklch(0.72 0.15 ${hue})`;
  const due = goal.due_month;

  const add = async () => {
    const v = parseAmount(amount);
    if (!v) return flash("Ingresá un monto");
    setBusy(true);
    const g = await contribute(goal.id, toDecimal(v));
    setBusy(false);
    if (!g) return;
    setAmount("");
    if (Number(g.saved) >= Number(g.target) && !done) flash(`¡Cumpliste "${g.name}"!`, "meta");
    else flash(`Aporte sumado a ${g.name}`, "ingreso");
  };

  return (
    <section className={s.goal} style={{ background: `radial-gradient(120% 70% at 50% 0%, oklch(0.72 0.15 ${hue} / .16), transparent 65%), var(--panel)` }}>
      <button
        className={`${s.goalDel} material-symbols-rounded`}
        data-confirm={confirmDel}
        title={confirmDel ? "Tocá de nuevo para eliminar" : "Eliminar meta"}
        onClick={async () => {
          if (!confirmDel) return setConfirmDel(true);
          if (await deleteGoal(goal.id)) flash("Meta eliminada");
        }}
        onBlur={() => setConfirmDel(false)}
      >
        {confirmDel ? "delete_forever" : "delete"}
      </button>
      <div className={s.goalRing}>
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r="52" className={s.track} />
          <circle cx="60" cy="60" r="52" className={s.bar} style={{ stroke: col, strokeDasharray: `${(Math.min(1, p) * RING).toFixed(1)} ${RING}`, filter: `drop-shadow(0 0 6px ${col})` }} />
        </svg>
        <div className={s.goalCenter}>
          <span className="material-symbols-rounded" style={{ background: `oklch(0.72 0.15 ${hue} / .16)`, color: col }}>
            {goal.icon}
          </span>
          <strong style={{ color: done ? "var(--pos)" : "var(--fg)" }}>{Math.round(p * 100)}%</strong>
        </div>
      </div>
      <div className={s.goalName}>
        <strong>{goal.name}</strong>
        <span>{due ? `${MONTH_FULL[Number(due.slice(5)) - 1]} ${due.slice(0, 4)} · faltan ${ml} ${ml === 1 ? "mes" : "meses"}` : "Sin fecha"}</span>
      </div>
      <div className={s.goalAmounts}>
        <strong>{formatMoney(Number(goal.saved), goal.currency)}</strong>
        <span>de {formatMoney(Number(goal.target), goal.currency)}</span>
      </div>
      <div className={s.goalNeed}>{left <= 0 ? "Meta cumplida" : `Aportá ${formatMoney(need, goal.currency)} por mes para llegar a tiempo`}</div>
      <div className={s.goalAdd}>
        <label>
          {goal.currency === "USD" ? "US$" : "$"}
          <input
            value={amount}
            onChange={(e) => setAmount(maskAmountInput(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            inputMode="decimal"
            placeholder="Monto"
            aria-label={`Aporte a ${goal.name}`}
          />
        </label>
        <button onClick={add} disabled={busy} style={{ background: col, boxShadow: `0 10px 24px -10px ${col}` }}>
          Aportar
        </button>
      </div>
    </section>
  );
}

function NewGoal({ count }: { count: number }) {
  const { flash } = useShell();
  const { saveGoal } = useData();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [target, setTarget] = useState("");
  const [due, setDue] = useState(addMonths(currentMonth(), 7));
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !parseAmount(target)) return flash("Completá nombre y monto");
    setBusy(true);
    const ok = await saveGoal(null, {
      name: name.trim(),
      icon: ICONS[count % ICONS.length],
      target: toDecimal(parseAmount(target)),
      currency,
      due_month: due || null,
    });
    setBusy(false);
    if (ok) {
      flash("Meta creada", "meta");
      setName("");
      setTarget("");
    }
  };

  return (
    <form className={s.newGoal} onSubmit={submit} noValidate>
      <div className={s.newGoalTitle}>
        <span className="material-symbols-rounded">add_circle</span>
        Nueva meta
      </div>
      <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Viaje a Europa, auto, mudanza" aria-label="Nombre de la meta" maxLength={60} />
      <div className={s.inline}>
        <button type="button" className={s.curBtn} onClick={() => setCurrency((c) => (c === "ARS" ? "USD" : "ARS"))} title="Cambiar moneda">
          {currency === "USD" ? "US$" : "$"}
        </button>
        <input className={s.input} value={target} onChange={(e) => setTarget(maskAmountInput(e.target.value))} inputMode="decimal" placeholder="Monto objetivo" aria-label="Monto objetivo" />
      </div>
      <label className={s.field}>
        Fecha objetivo
        <input className={s.input} type="month" value={due} min={addMonths(currentMonth(), 1)} onChange={(e) => setDue(e.target.value)} />
      </label>
      <button type="submit" className={s.outlineBtn} disabled={busy}>
        {busy ? "Creando…" : "Crear meta"}
      </button>
    </form>
  );
}
