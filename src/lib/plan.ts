// Totales del mes y plan de pagos de tarjetas (lógica del prototipo, sin React).

import { CATEGORY_BY_ID } from "@/lib/categories";
import type { Currency } from "@/lib/money";

type TxLike = { type: "in" | "out"; date: string; category_id: string; amount: string; currency: Currency };

export type MonthTotals = {
  inc: number;
  out: number;
  /** Gasto por categoría, en pesos. */
  byCat: Record<string, number>;
};

/** Ingresos, gastos y gasto por categoría de un mes, todo en pesos. */
export function monthTotals(txs: TxLike[], ym: string, toArs: (n: number, c: Currency) => number): MonthTotals {
  const t: MonthTotals = { inc: 0, out: 0, byCat: {} };
  for (const x of txs) {
    if (!x.date.startsWith(ym)) continue;
    const v = toArs(Number(x.amount), x.currency);
    if (x.type === "in") t.inc += v;
    else {
      t.out += v;
      t.byCat[x.category_id] = (t.byCat[x.category_id] ?? 0) + v;
    }
  }
  return t;
}

/** Gasto variable diario suavizado (ventana de 7 días), para la curva de Inicio. */
export function dailyVariableSpend(txs: TxLike[], ym: string, days: number, toArs: (n: number, c: Currency) => number) {
  const raw = Array.from({ length: days }, () => 0);
  for (const x of txs) {
    if (x.type !== "out" || !x.date.startsWith(ym) || CATEGORY_BY_ID[x.category_id]?.kind !== "var") continue;
    const d = Number(x.date.slice(8)) - 1;
    if (d < days) raw[d] += toArs(Number(x.amount), x.currency);
  }
  return raw.map((_, i) => {
    const w = raw.slice(Math.max(0, i - 3), i + 4);
    return w.reduce((s, v) => s + v, 0) / w.length;
  });
}

export type PlanCard = { id: string; name: string; balance: number; min: number; dueDay: number; tna: number };
export type Strategy = "intereses" | "avalancha" | "bola";

export type PlanRow = PlanCard & {
  pay: number;
  extra: number;
  left: number;
  tag: "Pago total" | "Parcial" | "Mínimo";
  tagColor: string;
  /** Interés estimado del mes que viene sobre lo que queda. */
  nextInterest: number;
  /** Interés que se evita al pagar todo. */
  avoidedInterest: number;
};

export type Plan = {
  /** Plata libre: ingresos − gastos hechos − fijos pendientes. */
  available: number;
  mins: number;
  rows: PlanRow[];
  cardsTotal: number;
  leftover: number;
  /** No alcanza para los mínimos. */
  short: boolean;
  shortBy: number;
};

/**
 * Reparte la plata libre entre tarjetas: primero todos los mínimos y lo que sobra según la estrategia.
 * - intereses: paga completa la que vence primero.
 * - avalancha: mayor tasa primero.
 * - bola: saldo más chico primero.
 */
export function computePlan(input: { income: number; spent: number; pendingFixed: number; cards: PlanCard[]; strategy: Strategy }): Plan {
  const available = input.income - input.spent - input.pendingFixed;
  const cards = input.cards.filter((c) => c.balance > 0);
  const mins = cards.reduce((s, c) => s + Math.min(c.min, c.balance), 0);
  const order = [...cards].sort((a, b) =>
    input.strategy === "avalancha" ? b.tna - a.tna : input.strategy === "bola" ? a.balance - b.balance : a.dueDay - b.dueDay,
  );
  let rest = available - mins;
  const rows = order.map((c): PlanRow => {
    const min = Math.min(c.min, c.balance);
    const extra = Math.max(0, Math.min(rest, c.balance - min));
    rest -= extra;
    const pay = min + extra;
    const left = c.balance - pay;
    const monthly = c.tna / 100 / 12;
    const full = left <= 0.005;
    return {
      ...c,
      pay,
      extra,
      left,
      tag: full ? "Pago total" : extra > 0 ? "Parcial" : "Mínimo",
      tagColor: full ? "var(--pos)" : extra > 0 ? "var(--amb)" : "var(--red)",
      nextInterest: left * monthly,
      avoidedInterest: full ? c.balance * monthly : extra * monthly,
    };
  });
  return {
    available,
    mins,
    rows,
    cardsTotal: rows.reduce((s, r) => s + r.pay, 0),
    leftover: Math.max(0, rest),
    short: available < mins,
    shortBy: Math.max(0, mins - available),
  };
}

/** Variación porcentual con signo: "+12,5%" / "−3,0%". */
export function pctChange(a: number, b: number) {
  if (!b) return "—";
  const p = (a / b - 1) * 100;
  return `${p >= 0 ? "+" : "−"}${Math.abs(p).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
