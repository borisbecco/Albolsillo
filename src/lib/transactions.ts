import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/http";
import { CATEGORY_BY_ID } from "@/lib/categories";

type Tx = Prisma.TransactionClient | PrismaClient;

const decimal = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Ingresá un monto")
  .refine((v) => Number(v) > 0, "Ingresá un monto");

const TxFields = z.object({
  type: z.enum(["in", "out"]),
  date: z.iso.date("Revisá la fecha"),
  description: z.string().trim().max(120),
  category_id: z.string().refine((id) => id in CATEGORY_BY_ID, "Elegí una categoría"),
  amount: decimal,
  currency: z.enum(["ARS", "USD"]),
  account_id: z.uuid().nullable(),
  card_id: z.uuid().nullable(),
  recurring: z.boolean(),
});

/** Alta: los opcionales toman su valor por defecto. */
export const TxInput = TxFields.extend({
  id: z.uuid().optional(), // client_id: lo genera el cliente para poder sincronizar sin conexión
  description: TxFields.shape.description.default(""),
  account_id: TxFields.shape.account_id.default(null),
  card_id: TxFields.shape.card_id.default(null),
  recurring: TxFields.shape.recurring.default(false),
});

/** Edición: solo cambia lo que viene (sin valores por defecto). */
export const TxPatch = TxFields.partial();

export type TxInputT = z.infer<typeof TxInput>;

/** Valida reglas que dependen de la base: dueño de la cuenta o tarjeta, moneda y tipo de categoría. */
export async function checkTxRefs(db: Tx, userId: string, t: TxInputT) {
  const cat = CATEGORY_BY_ID[t.category_id];
  if (cat.type !== t.type) throw new ApiError(400, "validation", "Esa categoría no corresponde a este tipo de movimiento.");
  if (t.account_id && t.card_id) throw new ApiError(400, "validation", "Elegí una cuenta o una tarjeta, no las dos.");

  if (t.account_id) {
    const acc = await db.account.findFirst({ where: { id: t.account_id, userId, deletedAt: null } });
    if (!acc) throw new ApiError(400, "validation", "No encontramos esa cuenta.");
    if (acc.currency !== t.currency) {
      throw new ApiError(400, "validation", `${acc.name} es en ${acc.currency === "USD" ? "dólares" : "pesos"}. Cambiá la moneda o la cuenta.`);
    }
  }
  if (t.card_id) {
    if (t.type === "in") throw new ApiError(400, "validation", "Los ingresos entran en una cuenta, no en una tarjeta.");
    const card = await db.card.findFirst({ where: { id: t.card_id, userId, deletedAt: null }, select: { id: true } });
    if (!card) throw new ApiError(400, "validation", "No encontramos esa tarjeta.");
  }
}

/** Suma o resta el movimiento del saldo de su cuenta (las tarjetas toman el saldo del resumen). */
export async function applyToBalance(
  db: Tx,
  t: { type: "in" | "out" | "card_payment"; accountId: string | null; grossAmount: Prisma.Decimal | string },
  direction: 1 | -1,
) {
  if (!t.accountId) return;
  const amount = new Prisma.Decimal(t.grossAmount.toString());
  const delta = t.type === "in" ? amount : amount.negated();
  await db.account.update({
    where: { id: t.accountId },
    data: { balance: { increment: direction === 1 ? delta : delta.negated() } },
  });
}

export const toDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}
