import { Prisma, type Card } from "@prisma/client";
import { z } from "zod";
import { toDate } from "@/lib/transactions";

type Db = Prisma.TransactionClient;

const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Revisá los montos");
const day = z.number().int().min(1, "El día va de 1 a 31").max(31, "El día va de 1 a 31");

/** Pago del resumen: cuánto, de qué cuenta y en qué moneda. */
export const CardPaymentInput = z.object({
  amount: money.refine((v) => Number(v) > 0, "Poné cuánto pagaste"),
  account_id: z.uuid().nullable().default(null),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  date: z.iso.date().optional(),
});

/** Resumen nuevo: cierra el ciclo. */
export const StatementInput = z.object({
  balance: money,
  balance_usd: money.default("0"),
  minimum: money,
  close_day: day,
  due_day: day,
  today: z.iso.date().optional(),
});

/** Divide el total en cuotas iguales (la última absorbe el redondeo). */
export function installmentAmount(total: Prisma.Decimal | string, of: number, n = 1) {
  const t = new Prisma.Decimal(total.toString());
  const each = t.div(of).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  return n === of ? t.minus(each.mul(of - 1)) : each;
}

/**
 * Cierra el ciclo de la tarjeta con el resumen nuevo: actualiza saldos y fechas, lo pagado
 * vuelve a cero, las cuotas avanzan una (las terminadas desaparecen) y la cuota siguiente de
 * cada compra cargada en la app se crea sola como gasto. Devuelve los movimientos creados.
 */
/** Cómo estaba la tarjeta antes de cerrar el ciclo, para deshacerlo. */
export type CycleSnapshot = {
  card: { balance: string; balanceUsd: string; minPayment: string; closeDay: number; dueDay: number; cyclePaid: string; cyclePaidUsd: string; cycleStart: string | null };
  statementId: string;
  installments: { id: string; n: number; finished: boolean }[];
  created: string[];
};

export async function closeCycle(
  db: Db,
  card: Card,
  s: { balance: string; balanceUsd: string; minimum: string; closeDay: number; dueDay: number; today: string },
  /** Al importar el PDF, las cuotas del resumen ya vienen con su número: solo avanzan las cargadas en la app. */
  opts: { onlyAppInstallments?: boolean } = {},
) {
  const snapshot: CycleSnapshot = {
    card: {
      balance: card.balance.toFixed(2),
      balanceUsd: card.balanceUsd.toFixed(2),
      minPayment: card.minPayment.toFixed(2),
      closeDay: card.closeDay,
      dueDay: card.dueDay,
      cyclePaid: card.cyclePaid.toFixed(2),
      cyclePaidUsd: card.cyclePaidUsd.toFixed(2),
      cycleStart: card.cycleStart ? card.cycleStart.toISOString().slice(0, 10) : null,
    },
    statementId: "",
    installments: [],
    created: [],
  };
  await db.card.update({
    where: { id: card.id },
    data: {
      balance: s.balance,
      balanceUsd: s.balanceUsd,
      minPayment: s.minimum,
      closeDay: s.closeDay,
      dueDay: s.dueDay,
      cyclePaid: 0,
      cyclePaidUsd: 0,
      cycleStart: toDate(s.today),
    },
  });
  const st = await db.cardStatement.create({
    data: { userId: card.userId, cardId: card.id, balance: s.balance, balanceUsd: s.balanceUsd, minimum: s.minimum, closeDay: s.closeDay, dueDay: s.dueDay },
  });

  snapshot.statementId = st.id;
  const created = [];
  const active = await db.cardInstallment.findMany({
    where: { cardId: card.id, deletedAt: null, cancelledAt: null, ...(opts.onlyAppInstallments && { firstTransactionId: { not: null } }) },
  });
  for (const q of active) {
    const n = q.n + 1;
    snapshot.installments.push({ id: q.id, n: q.n, finished: n > q.of });
    if (n > q.of) {
      await db.cardInstallment.update({ where: { id: q.id }, data: { deletedAt: new Date() } });
      continue;
    }
    await db.cardInstallment.update({ where: { id: q.id }, data: { n } });
    // Solo las compras cargadas en la app generan el gasto de la cuota (las importadas vienen en el resumen).
    if (q.firstTransactionId && q.total) {
      const tx = await db.transaction.create({
        data: {
          userId: card.userId,
          type: "out",
          date: toDate(s.today),
          description: `${q.name} (cuota ${n}/${q.of})`,
          categoryId: q.categoryId ?? "otros",
          amount: q.amount,
          grossAmount: q.amount,
          currency: "ARS",
          cardId: card.id,
          installmentId: q.id,
          installmentNumber: n,
        },
      });
      created.push(tx);
    }
  }
  snapshot.created = created.map((t) => t.id);
  return Object.assign(created, { snapshot });
}

/** Deshace un cierre de ciclo: vuelve la tarjeta, las cuotas y borra el resumen y las cuotas sumadas. */
export async function undoCloseCycle(db: Db, cardId: string, userId: string, s: CycleSnapshot) {
  await db.card.update({
    where: { id: cardId },
    data: { ...s.card, cycleStart: s.card.cycleStart ? toDate(s.card.cycleStart) : null },
  });
  await db.cardStatement.deleteMany({ where: { id: s.statementId, cardId } });
  for (const q of s.installments) {
    await db.cardInstallment.updateMany({ where: { id: q.id, cardId }, data: { n: q.n, ...(q.finished && { deletedAt: null }) } });
  }
  // Las cuotas sumadas son gastos de la tarjeta (no movieron saldos de cuentas): se borran.
  await db.transaction.deleteMany({ where: { id: { in: s.created }, userId, cardId } });
}
