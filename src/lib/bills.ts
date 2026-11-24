import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";

type Db = Prisma.TransactionClient | PrismaClient;

/** De dónde se paga un gasto fijo: cuenta (de la misma moneda) o tarjeta, del usuario. */
export async function checkBillRefs(
  userId: string,
  b: { account_id?: string | null; card_id?: string | null; currency?: "ARS" | "USD" },
  db: Db = prisma,
) {
  if (b.account_id && b.card_id) throw new ApiError(400, "validation", "Elegí una cuenta o una tarjeta, no las dos.");
  if (b.account_id) {
    const acc = await db.account.findFirst({ where: { id: b.account_id, userId, deletedAt: null } });
    if (!acc) throw new ApiError(400, "validation", "No encontramos esa cuenta.");
    if (b.currency && acc.currency !== b.currency) {
      throw new ApiError(400, "validation", `${acc.name} es en ${acc.currency === "USD" ? "dólares" : "pesos"}.`);
    }
  }
  if (b.card_id) {
    const card = await db.card.findFirst({ where: { id: b.card_id, userId, deletedAt: null }, select: { id: true } });
    if (!card) throw new ApiError(400, "validation", "No encontramos esa tarjeta.");
  }
}

/** Fecha del pago dentro del mes: hoy si es el mes actual, si no el día de vencimiento (acotado al mes). */
export function paymentDate(month: string, dueDay: number, today: string) {
  if (today.startsWith(month)) return today;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
}
