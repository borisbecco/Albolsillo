import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { CATEGORY_BY_ID } from "@/lib/categories";
import { accountDto, txDto } from "@/lib/dto";
import { detectedDto, merchantKey } from "@/lib/auto/detected";
import { applyToBalance } from "@/lib/transactions";

const Body = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
  /** Categorías aprendidas: se guarda la regla del comercio y se aplica a los pendientes. */
  learn: z.array(z.object({ id: z.uuid(), category_id: z.string() })).max(200).default([]),
  /** Ajustes de último momento (categoría y cuenta) por gasto. */
  edits: z.record(z.string(), z.object({ category_id: z.string().optional(), account_id: z.uuid().nullable().optional() })).default({}),
});

/** POST /detected/confirm { ids, learn?, edits? }: crea los movimientos, ajusta saldos y devuelve { transactions }. */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Body);

  const result = await prisma.$transaction(
    async (db) => {
      const rows = await db.detectedExpense.findMany({ where: { id: { in: b.ids }, userId, status: "pending" } });
      const accounts = await db.account.findMany({ where: { userId, deletedAt: null } });
      const created = [];
      for (const d of rows) {
        const e = b.edits[d.id] ?? {};
        const cat = e.category_id && CATEGORY_BY_ID[e.category_id]?.type === "out" ? e.category_id : (d.suggestedCategoryId ?? "otros");
        const accId = e.account_id !== undefined ? e.account_id : d.suggestedAccountId;
        const acc = accId ? accounts.find((a) => a.id === accId && a.currency === d.currency) : null;
        const tx = await db.transaction.create({
          data: {
            userId,
            type: "out",
            date: d.date,
            description: d.merchant,
            categoryId: cat,
            amount: d.amount,
            grossAmount: d.amount,
            currency: d.currency,
            accountId: acc?.id ?? null,
            merchantDomain: d.merchantDomain,
            source: d.origin === "mail" ? "mail" : "share",
            detectedExpenseId: d.id,
          },
        });
        await applyToBalance(db, tx, 1);
        await db.detectedExpense.update({ where: { id: d.id }, data: { status: "confirmed", transactionId: tx.id, suggestedCategoryId: cat } });
        created.push(tx);
      }

      // Reglas aprendidas: por comercio; se aplican a lo que sigue pendiente del mismo comercio.
      let learned = 0;
      for (const l of b.learn) {
        if (CATEGORY_BY_ID[l.category_id]?.type !== "out") continue;
        const d = await db.detectedExpense.findFirst({ where: { id: l.id, userId } });
        if (!d) continue;
        const key = merchantKey(d.merchant);
        if (!key) continue;
        await db.merchantRule.upsert({
          where: { userId_merchantKey: { userId, merchantKey: key } },
          create: { userId, merchantKey: key, merchantLabel: d.merchant, categoryId: l.category_id },
          update: { categoryId: l.category_id, merchantLabel: d.merchant },
        });
        learned++;
        const pending = await db.detectedExpense.findMany({ where: { userId, status: "pending" } });
        for (const p of pending) {
          if (merchantKey(p.merchant) === key) await db.detectedExpense.update({ where: { id: p.id }, data: { suggestedCategoryId: l.category_id, learned: true } });
        }
      }
      const touched = [...new Set(created.map((t) => t.accountId).filter(Boolean))] as string[];
      const accs = await db.account.findMany({ where: { id: { in: touched } } });
      const left = await db.detectedExpense.findMany({ where: { userId, status: "pending" }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
      return { created, accs, learned, left };
    },
    { timeout: 30_000 },
  );

  return Response.json({
    transactions: result.created.map(txDto),
    accounts: result.accs.map(accountDto),
    learned: result.learned,
    pending: result.left.map(detectedDto),
  });
});
