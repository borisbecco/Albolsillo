// Totales del mes y plan de pagos de tarjetas (lógica del prototipo, sin React).

import { CATEGORY_BY_ID } from "@/lib/categories";
import type { Currency } from "@/lib/money";

type TxLike = { type: "in" | "out" | "card_payment"; date: string; category_id: string; amount: string; currency: Currency };

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
    else if (x.type === "out") {
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

/** balance: saldo del resumen (pesos + dólares convertidos); paid: lo ya pagado en el ciclo. */
export type PlanCard = { id: string; name: string; balance: number; min: number; dueDay: number; tna: number; paid?: number };
export type Strategy = "intereses" | "avalancha" | "bola";

export type PlanRow = PlanCard & {
  pay: number;
  extra: number;
  left: number;
  tag: "Pago total" | "Parcial" | "Mínimo" | "Mínimo cubierto" | "Pagado";
  /** Lo que ya se pagó de este resumen. */
  paid: number;
  /** El resumen ya está cubierto. */
  done: boolean;
  tagColor: string;
  /** Interés estimado del mes que viene sobre lo que queda. */
  nextInterest: number;
  /** Interés que se evita al pagar todo. */
  avoidedInterest: number;
};

export type Plan = {
  /** Plata libre: ingresos − gastos hechos − fijos pendientes − reserva variable. */
  available: number;
  mins: number;
  rows: PlanRow[];
  cardsTotal: number;
  leftover: number;
  /** No alcanza para los mínimos (que todavía falta pagar). */
  short: boolean;
  shortBy: number;
  /** Con los mínimos ya cubiertos, cuánto se pasan los gastos (y la reserva) de lo que entra. */
  over: number;
  /** Lo ya pagado a tarjetas este ciclo. */
  paid: number;
};

/**
 * Reparte la plata libre entre tarjetas: primero todos los mínimos y lo que sobra según la estrategia.
 * - intereses: paga completa la que vence primero.
 * - avalancha: mayor tasa primero.
 * - bola: saldo más chico primero.
 */
export type PlanInput = {
  income: number;
  spent: number;
  pendingFixed: number;
  /** Lo que queda por gastar del presupuesto de las categorías variables. */
  reserve?: number;
  cards: PlanCard[];
  strategy: Strategy;
};

export function computePlan(input: PlanInput): Plan {
  // Lo ya pagado a las tarjetas salió del ingreso del mes: se descuenta de lo disponible,
  // y cada tarjeta queda con lo que falta (el mínimo también baja).
  const paidTotal = input.cards.reduce((s, c) => s + Math.min(c.paid ?? 0, c.balance), 0);
  const available = input.income - input.spent - input.pendingFixed - (input.reserve ?? 0) - paidTotal;
  const doneRows: PlanRow[] = input.cards
    .filter((c) => c.balance > 0 && (c.paid ?? 0) >= c.balance - 0.005)
    .map((c) => ({ ...c, paid: c.paid ?? 0, done: true, pay: 0, extra: 0, left: 0, tag: "Pagado", tagColor: "var(--pos)", nextInterest: 0, avoidedInterest: 0 }));
  const cards = input.cards
    .filter((c) => c.balance - (c.paid ?? 0) > 0.005)
    .map((c) => ({ ...c, paid: c.paid ?? 0, balance: c.balance - (c.paid ?? 0), min: Math.max(0, c.min - (c.paid ?? 0)) }));
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
    // Lo pagado ya cubre el mínimo y este mes no alcanza para adelantar más.
    const minCovered = !full && extra <= 0 && min <= 0.005 && c.paid > 0;
    return {
      ...c,
      done: false,
      pay,
      extra,
      left,
      tag: full ? "Pago total" : extra > 0 ? "Parcial" : minCovered ? "Mínimo cubierto" : "Mínimo",
      tagColor: full ? "var(--pos)" : extra > 0 || minCovered ? "var(--amb)" : "var(--red)",
      nextInterest: left * monthly,
      avoidedInterest: full ? c.balance * monthly : extra * monthly,
    };
  });
  rows.push(...doneRows);
  return {
    available,
    mins,
    rows,
    cardsTotal: rows.reduce((s, r) => s + r.pay, 0),
    leftover: Math.max(0, rest),
    // "Faltan para los mínimos" solo si queda algún mínimo por pagar; si no, es que se gastó de más.
    short: mins > 0.005 && available < mins,
    shortBy: Math.max(0, mins - available),
    over: mins > 0.005 ? 0 : Math.max(0, -available),
    paid: paidTotal,
  };
}

/** Variación porcentual con signo: "+12,5%" / "−3,0%". */
export function pctChange(a: number, b: number) {
  if (!b) return "—";
  const p = (a / b - 1) * 100;
  return `${p >= 0 ? "+" : "−"}${Math.abs(p).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Interés estimado del mes que viene con cada estrategia (para compararlas). */
export function interestByStrategy(input: Omit<PlanInput, "strategy">): Record<Strategy, number> {
  const sim = (strategy: Strategy) => computePlan({ ...input, strategy }).rows.reduce((s, r) => s + r.nextInterest, 0);
  return { intereses: sim("intereses"), avalancha: sim("avalancha"), bola: sim("bola") };
}
