import { randomInt } from "node:crypto";
import { Prisma, type DetectedExpense } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { entityDomain, findEntity, norm } from "@/lib/entities";
import { guessCategory, merchantDomain } from "@/lib/merchants";
import { toDate } from "@/lib/transactions";

type Db = Prisma.TransactionClient | typeof prisma;

/** Dirección única de la casilla de entrada (Gmail con contraseña de aplicación). */
export const inboxAddress = () => process.env.INBOX_ADDRESS ?? "albolsillo.entrada@gmail.com";
export const forwardAddress = (code: string) => inboxAddress().replace("@", `+${code}@`);

const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
export async function newAddressCode(db: Db) {
  for (let i = 0; i < 6; i++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
    if (!(await db.expenseSource.findUnique({ where: { addressCode: code } }))) return code;
  }
  throw new Error("No se pudo generar el código de la dirección");
}

/** Clave del comercio para las categorías aprendidas: minúsculas, sin tildes ni signos. */
export const merchantKey = (m: string) =>
  norm(m)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function detectedDto(d: DetectedExpense) {
  return {
    id: d.id,
    origin: d.origin,
    wallet: d.wallet,
    merchant: d.merchant,
    merchant_domain: d.merchantDomain,
    amount: d.amount.toFixed(2),
    currency: d.currency,
    date: d.date.toISOString().slice(0, 10),
    category_id: d.suggestedCategoryId ?? "otros",
    account_id: d.suggestedAccountId,
    possible_duplicate_of: d.possibleDuplicateOf,
    learned: d.learned,
    status: d.status,
  };
}
export type DetectedDto = ReturnType<typeof detectedDto>;

/**
 * Crea un gasto detectado (pendiente de confirmar). La regla aprendida del usuario manda sobre la
 * sugerencia automática; la cuenta sale de la billetera; marca posibles duplicados.
 * Devuelve null si ya existía (mismo message_id o archivo).
 */
export async function createDetected(
  db: Db,
  userId: string,
  d: { sourceId: string | null; origin: "mail" | "share"; externalId: string; wallet: string | null; merchant: string; amount: number; currency: "ARS" | "USD"; date: string },
) {
  if (await db.detectedExpense.findFirst({ where: { userId, externalId: d.externalId }, select: { id: true } })) return null;

  const key = merchantKey(d.merchant);
  const rule = key ? await db.merchantRule.findUnique({ where: { userId_merchantKey: { userId, merchantKey: key } } }) : null;
  const guess = guessCategory(d.merchant);
  const categoryId = rule?.categoryId ?? (guess && CATEGORY_BY_ID[guess]?.type === "out" ? guess : "otros");

  // Cuenta sugerida: la del usuario que coincide con la billetera (un mail de Mercado Pago → su cuenta Mercado Pago).
  const walletDomain = d.wallet ? (findEntity(d.wallet)?.domain ?? entityDomain(d.wallet)) : null;
  const accounts = await db.account.findMany({ where: { userId, deletedAt: null, currency: d.currency } });
  const account = walletDomain ? accounts.find((a) => entityDomain(a.name) === walletDomain) : null;

  // Posible duplicado: mismo monto en ±2 días y descripción parecida.
  const day = toDate(d.date);
  const near = await db.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      type: "out",
      grossAmount: new Prisma.Decimal(d.amount.toFixed(2)),
      date: { gte: new Date(day.getTime() - 2 * 86_400_000), lte: new Date(day.getTime() + 2 * 86_400_000) },
    },
    select: { id: true, description: true },
  });
  const first = key.split(" ")[0] ?? "";
  const dup = near.find((t) => {
    const k = merchantKey(t.description);
    return !first || k.includes(first) || key.includes(k.split(" ")[0] ?? "");
  });

  return db.detectedExpense.create({
    data: {
      userId,
      sourceId: d.sourceId,
      origin: d.origin,
      externalId: d.externalId,
      wallet: d.wallet,
      merchant: d.merchant.slice(0, 80),
      merchantDomain: merchantDomain(d.merchant),
      amount: d.amount.toFixed(2),
      currency: d.currency,
      date: day,
      suggestedCategoryId: categoryId,
      suggestedAccountId: account?.id ?? null,
      possibleDuplicateOf: dup?.id ?? null,
      learned: !!rule,
    },
  });
}
