// Categorías aprendidas (merchant_rules): se aprenden al elegir una categoría a mano y se usan para sugerir.

import type { Prisma, PrismaClient } from "@prisma/client";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { learnableKey, merchantKey } from "@/lib/merchant-key";

type Db = PrismaClient | Prisma.TransactionClient;

/** Guarda (o actualiza) la regla "este comercio → esta categoría". No aprende "Otros" ni nombres genéricos. */
export async function learnRule(db: Db, userId: string, description: string, categoryId: string) {
  const key = merchantKey(description);
  if (!learnableKey(key) || categoryId === "otros" || categoryId === "otros_in" || !CATEGORY_BY_ID[categoryId]) return false;
  await db.merchantRule.upsert({
    where: { userId_merchantKey: { userId, merchantKey: key } },
    update: { categoryId, merchantLabel: description.trim().slice(0, 60) },
    create: { userId, merchantKey: key, merchantLabel: description.trim().slice(0, 60), categoryId },
  });
  return true;
}

/** Reglas del usuario como mapa clave → categoría. */
export async function rulesMap(db: Db, userId: string) {
  const rows = await db.merchantRule.findMany({ where: { userId }, select: { merchantKey: true, categoryId: true } });
  return new Map(rows.map((r) => [r.merchantKey, r.categoryId]));
}

/** Movimientos del usuario en "Otros" del mismo comercio (para ofrecer recategorizarlos juntos). */
export async function sameMerchantInOtros(db: Db, userId: string, description: string, exceptId?: string) {
  const key = merchantKey(description);
  if (!learnableKey(key)) return [];
  const rows = await db.transaction.findMany({
    where: { userId, deletedAt: null, categoryId: "otros", type: "out", ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true, description: true },
    take: 2000,
  });
  return rows.filter((r) => merchantKey(r.description) === key).map((r) => r.id);
}
