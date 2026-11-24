import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/categories";
import { computePlan } from "@/lib/plan";
import { monthRange } from "@/lib/transactions";

// Avisos de vencimientos: qué avisarle a cada usuario hoy (mail y push).

export type DueItem = {
  kind: "card" | "bill" | "loan";
  name: string;
  day: number;
  daysLeft: number;
  amount: number;
  currency: "ARS" | "USD";
  min?: number;
  suggested?: number;
  suggestedTag?: string;
};

export type Notice = {
  user: { id: string; name: string; email: string; alertDays: number; mailAlerts: "off" | "each" | "daily"; pushEnabled: boolean; payStrategy: string };
  due: DueItem[];
  spentYesterday: number;
  available: number;
  budgetAlerts: { name: string; spent: number; limit: number }[];
};

/** Fecha de hoy en Argentina (YYYY-MM-DD). */
export const todayAR = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);

/** Calcula los avisos del día de un usuario. Devuelve null si no hay nada que avisar. */
export async function buildNotice(userId: string, today = todayAR()): Promise<Notice | null> {
  const month = today.slice(0, 7);
  const day = Number(today.slice(8));
  const yesterday = todayAR(new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000));
  const live = { userId, deletedAt: null };

  const [user, cards, bills, payments, txs, budgets, fx, loans] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.card.findMany({ where: live }),
    prisma.bill.findMany({ where: live }),
    prisma.billPayment.findMany({ where: { ...live, month } }),
    prisma.transaction.findMany({ where: { ...live, date: monthRange(month) } }),
    prisma.budget.findMany({ where: { ...live, month } }),
    prisma.fxRate.findMany(),
    prisma.loan.findMany({ where: live }),
  ]);
  const rate = user.rateType === "manual" ? Number(user.manualRate ?? 0) : Number(fx.find((f) => f.type === user.rateType)?.sell ?? 0);
  const toArs = (n: number, c: string) => (c === "USD" ? n * rate : n);

  const inc = txs.filter((t) => t.type === "in").reduce((s, t) => s + toArs(Number(t.amount), t.currency), 0);
  const out = txs.filter((t) => t.type === "out").reduce((s, t) => s + toArs(Number(t.amount), t.currency), 0);
  const byCat: Record<string, number> = {};
  for (const t of txs) if (t.type === "out") byCat[t.categoryId] = (byCat[t.categoryId] ?? 0) + toArs(Number(t.amount), t.currency);
  const paid = new Set(payments.map((p) => p.billId));
  const pending = bills.filter((b) => !paid.has(b.id));
  const pendingLoans = loans.filter((l) => l.n < l.of && l.lastPaidMonth !== month);
  const pendingFixed =
    pending.reduce((s, b) => s + toArs(Number(b.amount), b.currency), 0) + pendingLoans.reduce((s, l) => s + Number(l.installment), 0);
  const limitOf = (id: string) => Number(budgets.find((b) => b.categoryId === id)?.amount ?? CATEGORY_BY_ID[id]?.budget ?? 0);
  const outCats = CATEGORIES.filter((c) => c.type === "out" && c.id !== "prestamo");
  const reserve = outCats.filter((c) => c.kind === "var").reduce((s, c) => s + Math.max(0, limitOf(c.id) - (byCat[c.id] ?? 0)), 0);
  const income = Math.max(inc, toArs(Number(user.salary ?? 0), user.salaryCurrency) + toArs(Number(user.usdIncome ?? 0), user.otherIncomeCurrency));

  const plan = computePlan({
    income,
    spent: out,
    pendingFixed,
    reserve,
    strategy: user.payStrategy,
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      balance: Number(c.balance) + toArs(Number(c.balanceUsd), "USD"),
      paid: Number(c.cyclePaid) + toArs(Number(c.cyclePaidUsd), "USD"),
      min: Number(c.minPayment),
      dueDay: c.dueDay,
      tna: Number(c.tna),
    })),
  });

  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const due: DueItem[] = [];
  for (const c of cards) {
    const d = Math.min(c.dueDay, lastDay);
    const left = d - day;
    const row = plan.rows.find((r) => r.id === c.id);
    if (!row || row.done || left < 0 || left > user.alertDays) continue;
    due.push({ kind: "card", name: c.name, day: d, daysLeft: left, amount: row.balance, currency: "ARS", min: row.min, suggested: row.pay, suggestedTag: row.tag });
  }
  for (const b of pending) {
    const d = Math.min(b.dueDay, lastDay);
    const left = d - day;
    if (left < 0 || left > user.alertDays || b.autoDebit) continue;
    due.push({ kind: "bill", name: b.name, day: d, daysLeft: left, amount: Number(b.amount), currency: b.currency });
  }
  for (const l of pendingLoans) {
    const d = Math.min(l.dueDay, lastDay);
    const left = d - day;
    if (left < 0 || left > user.alertDays) continue;
    due.push({ kind: "loan", name: `Cuota ${l.n + 1}/${l.of} · ${l.name}`, day: d, daysLeft: left, amount: Number(l.installment), currency: "ARS" });
  }
  due.sort((a, b) => a.daysLeft - b.daysLeft);

  const budgetAlerts = outCats
    .map((c) => ({ name: c.name, spent: byCat[c.id] ?? 0, limit: limitOf(c.id) }))
    .filter((b) => b.limit > 0 && b.spent >= b.limit * 0.8)
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
    .slice(0, 3);

  const spentYesterday = txs
    .filter((t) => t.type === "out" && t.date.toISOString().slice(0, 10) === yesterday)
    .reduce((s, t) => s + toArs(Number(t.amount), t.currency), 0);

  if (!due.length && (user.mailAlerts !== "daily" || (!budgetAlerts.length && !spentYesterday))) return null;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      alertDays: user.alertDays,
      mailAlerts: user.mailAlerts,
      pushEnabled: user.pushEnabled,
      payStrategy: user.payStrategy,
    },
    due,
    spentYesterday,
    available: inc - out,
    budgetAlerts,
  };
}

/** Token firmado para el link de baja del resumen diario (no expira; cambia si cambia JWT_SECRET). */
export function unsubscribeToken(userId: string) {
  const sig = createHmac("sha256", process.env.JWT_SECRET ?? "").update(`baja:${userId}`).digest("base64url").slice(0, 32);
  return `${Buffer.from(userId).toString("base64url")}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [id64, sig] = token.split(".");
  if (!id64 || !sig) return null;
  const userId = Buffer.from(id64, "base64url").toString();
  const expected = unsubscribeToken(userId).split(".")[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}
