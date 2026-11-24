import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type Transaction } from "@prisma/client";
import { ApiError } from "@/lib/http";
import { applyToBalance } from "@/lib/transactions";

type Db = Prisma.TransactionClient;

// Borrado lógico de movimientos con todos sus efectos (saldo de la cuenta, préstamo,
// gasto fijo, pago de tarjeta, compra en cuotas) y la vuelta atrás para "Deshacer".

/** Efectos de sacar un movimiento. Devuelve los ids extra que también se borraron. */
async function undoEffects(db: Db, tx: Transaction) {
  await applyToBalance(db, tx, -1);

  // Cuota de préstamo: el préstamo vuelve una cuota atrás.
  const loan = tx.loanId
    ? await db.loan.findFirst({ where: { id: tx.loanId } })
    : await db.loan.findFirst({ where: { lastPaymentTxId: tx.id } });
  if (loan && (loan.lastPaymentTxId === tx.id || tx.loanId)) {
    await db.loan.update({
      where: { id: loan.id },
      data: {
        n: Math.max(0, loan.n - 1),
        balance: { increment: tx.loanId ? tx.grossAmount : loan.installment },
        ...(loan.lastPaymentTxId === tx.id && { lastPaidMonth: null, lastPaymentTxId: null, paidThisMonth: false }),
      },
    });
  }

  // Pago de un gasto fijo: vuelve a quedar pendiente (se conserva el vínculo para poder restaurarlo).
  if (tx.billId) await db.billPayment.updateMany({ where: { transactionId: tx.id, deletedAt: null }, data: { deletedAt: new Date() } });

  // Pago del resumen de una tarjeta: se descuenta de lo pagado del ciclo.
  if (tx.type === "card_payment" && tx.cardId) {
    const field = tx.currency === "USD" ? "cyclePaidUsd" : "cyclePaid";
    await db.card.update({ where: { id: tx.cardId }, data: { [field]: { decrement: tx.grossAmount } } });
  }

  // Cuota 1 de una compra en cuotas: se cancela la compra.
  if (tx.installmentId && tx.installmentNumber === 1) {
    await db.cardInstallment.updateMany({ where: { id: tx.installmentId, cancelledAt: null }, data: { cancelledAt: new Date() } });
  }
}

/** Efectos de volver a poner un movimiento borrado. */
async function redoEffects(db: Db, tx: Transaction) {
  await applyToBalance(db, tx, 1);

  if (tx.loanId) {
    const loan = await db.loan.findFirst({ where: { id: tx.loanId, deletedAt: null } });
    if (loan) {
      const left = new Prisma.Decimal(loan.balance).minus(tx.grossAmount);
      await db.loan.update({
        where: { id: loan.id },
        data: {
          n: Math.min(loan.of, loan.n + 1),
          balance: left.isNegative() ? 0 : left,
          lastPaidMonth: tx.date.toISOString().slice(0, 7),
          lastPaymentTxId: tx.id,
        },
      });
    }
  }

  if (tx.billId) {
    const bp = await db.billPayment.findFirst({ where: { transactionId: tx.id } });
    if (bp) {
      const other = await db.billPayment.findFirst({ where: { billId: bp.billId, month: bp.month, deletedAt: null, NOT: { id: bp.id } } });
      if (!other) await db.billPayment.update({ where: { id: bp.id }, data: { deletedAt: null } });
    }
  }

  if (tx.type === "card_payment" && tx.cardId) {
    const field = tx.currency === "USD" ? "cyclePaidUsd" : "cyclePaid";
    await db.card.update({ where: { id: tx.cardId }, data: { [field]: { increment: tx.grossAmount } } });
  }

  if (tx.installmentId && tx.installmentNumber === 1) {
    await db.cardInstallment.updateMany({ where: { id: tx.installmentId }, data: { cancelledAt: null } });
  }
}

/** Borra (lógicamente) los movimientos del usuario. Devuelve los movimientos borrados. */
export async function deleteTransactions(db: Db, userId: string, ids: string[]) {
  const rows = await db.transaction.findMany({ where: { id: { in: ids }, userId, deletedAt: null } });
  if (!rows.length) throw new ApiError(404, "not_found", "No encontramos esos movimientos.");
  const now = new Date();
  for (const tx of rows) {
    await db.transaction.update({ where: { id: tx.id }, data: { deletedAt: now } });
    await undoEffects(db, tx);
  }
  return rows;
}

/** Vuelve a poner movimientos borrados (si siguen borrados). */
export async function restoreTransactions(db: Db, userId: string, ids: string[]) {
  const rows = await db.transaction.findMany({ where: { id: { in: ids }, userId, deletedAt: { not: null } } });
  for (const tx of rows) {
    await db.transaction.update({ where: { id: tx.id }, data: { deletedAt: null } });
    await redoEffects(db, tx);
  }
  return rows.map((r) => r.id);
}

// ─── Token de deshacer: firmado, válido 24 h, sin guardar nada ───

const UNDO_TTL = 24 * 3600_000;
const sign = (payload: string) => createHmac("sha256", process.env.JWT_SECRET ?? "").update(`undo:${payload}`).digest("base64url");

export function undoToken(userId: string, ids: string[]) {
  const payload = Buffer.from(JSON.stringify({ u: userId, ids, exp: Date.now() + UNDO_TTL })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readUndoToken(userId: string, token: string): string[] {
  const [payload, sig] = token.split(".");
  const bad = () => new ApiError(422, "undo_invalid", "Ya no se puede deshacer.");
  if (!payload || !sig) throw bad();
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw bad();
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; ids: string[]; exp: number };
  if (data.u !== userId || data.exp < Date.now()) throw bad();
  return data.ids;
}
