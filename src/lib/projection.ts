// Proyección de los próximos 12 meses y simulador "¿Me lo puedo permitir?" (handoff v11 › Proyección).
// Lógica pura: la vista le pasa los números del mes y las cuotas que ya existen.

export const CUOTA_OPTS = [1, 3, 6, 9, 12, 18] as const;

export type ProjectionInput = {
  /** Mes actual "YYYY-MM". */
  month: string;
  /** Libre de este mes: ingresos − gastos hechos − fijos pendientes − reserva variable. */
  freeNow: number;
  /** Ingresos estimados por mes. */
  income: number;
  /** Gastos fijos por mes (todos, pagados o no). */
  billsMonthly: number;
  /** Gasto variable promedio por mes. */
  variableMonthly: number;
  /** Préstamos: cuota, cuotas pagadas, total y si la de este mes ya se pagó. */
  loans: { name: string; installment: number; n: number; of: number; paidThisMonth: boolean }[];
  /** Compras en cuotas con tarjeta: cuota actual (n) de of. */
  installments: { name: string; amount: number; n: number; of: number }[];
};

export type ProjectedMonth = {
  k: number;
  /** "YYYY-MM" */
  ym: string;
  loansA: number;
  cuotasA: number;
  free: number;
  ends: { name: string; amt: number }[];
};

export type Simulation = {
  amount: number;
  cuotas: number;
  /** Recargo total en %. */
  surcharge: number;
};

export type Verdict = "none" | "ok" | "tight" | "no" | "pre";

const ymAdd = (ym: string, k: number) => {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/** Los 12 meses desde el actual, sin la compra. */
export function projectMonths(i: ProjectionInput): ProjectedMonth[] {
  return Array.from({ length: 12 }, (_, k) => {
    const ln = i.loans.map((l) => ({ l, idx: l.n + (l.paidThisMonth ? k : k + 1) })).filter((o) => o.idx <= o.l.of);
    const cq = i.installments.map((x) => ({ x, idx: x.n + k })).filter((o) => o.idx <= o.x.of);
    const loansA = ln.reduce((s, o) => s + o.l.installment, 0);
    const cuotasA = cq.reduce((s, o) => s + o.x.amount, 0);
    const ends = [...ln.filter((o) => o.idx === o.l.of).map((o) => ({ name: o.l.name, amt: o.l.installment })), ...cq.filter((o) => o.idx === o.x.of).map((o) => ({ name: o.x.name, amt: o.x.amount }))];
    const free = k === 0 ? i.freeNow : i.income - i.billsMonthly - loansA - cuotasA - i.variableMonthly;
    return { k, ym: ymAdd(i.month, k), loansA, cuotasA, free, ends };
  });
}

/** Libre de un mes con la compra (la cuota cuenta desde este mes y durante n meses). */
export const freeAfter = (m: ProjectedMonth, cuota: number, n: number) => m.free - (m.k < n ? cuota : 0);

/** Simula la compra: cuota, mes más ajustado, veredicto y, si no entra, con cuántas cuotas sí. */
export function simulate(months: ProjectedMonth[], income: number, sim: Simulation) {
  const total = sim.amount * (1 + Math.max(0, sim.surcharge) / 100);
  const n = sim.cuotas;
  const cuota = total / n;
  const has = sim.amount > 0;
  const buffer = income * 0.05;
  // El mes más ajustado entre los que pagan cuota (los que ya venían en rojo se cuentan aparte).
  const worstOf = (cuotas: number) => {
    const q = total / cuotas;
    const ms = months.slice(0, cuotas).filter((m) => m.free >= 0);
    return ms.length ? ms.reduce((w, m) => (freeAfter(m, q, cuotas) < freeAfter(w, q, cuotas) ? m : w)) : null;
  };
  const worst = worstOf(n);
  const worstFree = worst ? freeAfter(worst, cuota, n) : 0;
  const alreadyRed = months.slice(0, n).filter((m) => m.free < 0);
  const verdict: Verdict = !has ? "none" : !worst ? "pre" : worstFree < 0 ? "no" : worstFree < buffer ? "tight" : "ok";
  const better =
    verdict === "no" || verdict === "tight"
      ? (CUOTA_OPTS.filter((o) => o > n).find((o) => {
          const w = worstOf(o);
          return !!w && freeAfter(w, total / o, o) >= buffer;
        }) ?? null)
      : null;
  return { total, cuota, has, buffer, worst, worstFree, alreadyRed, verdict, better };
}
