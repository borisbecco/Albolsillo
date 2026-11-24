import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { cardDto, installmentDto, txDto } from "@/lib/dto";
import { closeCycle } from "@/lib/cards";
import { todayAR } from "@/lib/notify";
import { CATEGORY_BY_ID } from "@/lib/categories";
import type { ParsedRow } from "@/lib/import/statement";
import { merchantDomain } from "@/lib/merchants";
import { toDate } from "@/lib/transactions";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  row_ids: z.array(z.string()).max(500),
  categories: z.record(z.string(), z.string()).default({}),
  /** Actualizar saldo, mínimo y vencimiento de la tarjeta con los del resumen. */
  update_card: z.boolean().default(true),
});

type Stored = { rows: (ParsedRow & { duplicate: boolean })[]; summary: { due_date: string | null; close_date: string | null; balance_ars: string | null; balance_usd?: string | null; min_payment: string | null } };

// POST /imports/:id/confirm: crea los movimientos elegidos (imported = true) y actualiza las cuotas.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, Body);

  const imp = await prisma.import.findFirst({ where: { id, userId, deletedAt: null } });
  if (!imp) throw new ApiError(404, "not_found", "No encontramos esa importación.");
  if (imp.status === "confirmed") throw new ApiError(409, "already_imported", "Ya importaste este resumen.");
  const stored = imp.rows as unknown as Stored;
  const chosen = stored.rows.filter((r) => b.row_ids.includes(r.row_id) && r.kind !== "payment");

  const result = await prisma.$transaction(
    async (db) => {
      const created = [];
      for (const r of chosen) {
        const cat = b.categories[r.row_id];
        const categoryId = cat && CATEGORY_BY_ID[cat]?.type === "out" ? cat : r.suggested_category;
        const tx = await db.transaction.create({
          data: {
            userId,
            type: "out",
            date: toDate(r.date),
            description: r.installment ? `${r.description} (cuota ${r.installment.n}/${r.installment.of})` : r.description,
            categoryId,
            amount: r.amount,
            grossAmount: r.amount,
            currency: r.currency,
            cardId: imp.cardId,
            imported: true,
            importId: imp.id,
            merchantDomain: merchantDomain(r.description),
          },
        });
        created.push(tx);

        // Cuotas: una fila por compra en cuotas; se actualiza el número de cuota.
        if (r.installment) {
          const found = await db.cardInstallment.findFirst({ where: { userId, cardId: imp.cardId, name: r.description, of: r.installment.of, deletedAt: null } });
          if (found) await db.cardInstallment.update({ where: { id: found.id }, data: { n: Math.max(found.n, r.installment.n), amount: r.amount } });
          else await db.cardInstallment.create({ data: { userId, cardId: imp.cardId, name: r.description, n: r.installment.n, of: r.installment.of, amount: r.amount } });
        }
      }

      let card = await db.card.findUniqueOrThrow({ where: { id: imp.cardId } });
      const s = stored.summary;
      if (b.update_card && (s.balance_ars || s.min_payment || s.due_date)) {
        // Resumen nuevo: igual que cargarlo a mano (cierra el ciclo y suma las cuotas de lo cargado en la app).
        const more = await closeCycle(
          db,
          card,
          {
            balance: s.balance_ars ?? card.balance.toFixed(2),
            balanceUsd: s.balance_usd ?? card.balanceUsd.toFixed(2),
            minimum: s.min_payment ?? card.minPayment.toFixed(2),
            dueDay: s.due_date ? Number(s.due_date.slice(8)) : card.dueDay,
            closeDay: s.close_date ? Number(s.close_date.slice(8)) : card.closeDay,
            today: todayAR(),
          },
          { onlyAppInstallments: true },
        );
        created.push(...more);
        card = await db.card.findUniqueOrThrow({ where: { id: imp.cardId } });
      }
      await db.import.update({ where: { id: imp.id }, data: { status: "confirmed", rowsImported: created.length } });
      const installments = await db.cardInstallment.findMany({ where: { userId, cardId: imp.cardId, deletedAt: null, cancelledAt: null } });
      return { created, card, installments };
    },
    { timeout: 30_000 },
  );

  return Response.json({
    imported: result.created.length,
    transactions: result.created.map(txDto),
    card: cardDto(result.card),
    installments: result.installments.map(installmentDto),
  });
});
