import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { cardDto, installmentDto, txDto } from "@/lib/dto";
import { StatementInput, closeCycle } from "@/lib/cards";
import { todayAR } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /cards/:id/statements { balance, balance_usd, minimum, close_day, due_day }: carga el resumen
 * nuevo y cierra el ciclo (lo pagado vuelve a cero, las cuotas avanzan y se suma la cuota siguiente).
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, StatementInput);

  const result = await prisma.$transaction(
    async (db) => {
      const card = await db.card.findFirst({ where: { id, userId, deletedAt: null } });
      if (!card) throw new ApiError(404, "not_found", "No encontramos esa tarjeta.");
      const created = await closeCycle(db, card, {
        balance: b.balance,
        balanceUsd: b.balance_usd,
        minimum: b.minimum,
        closeDay: b.close_day,
        dueDay: b.due_day,
        today: b.today ?? todayAR(),
      });
      const updated = await db.card.findUniqueOrThrow({ where: { id } });
      const installments = await db.cardInstallment.findMany({ where: { cardId: id, deletedAt: null, cancelledAt: null }, orderBy: { createdAt: "asc" } });
      return { created, updated, installments };
    },
    { timeout: 30_000 },
  );

  return Response.json({
    card: cardDto(result.updated),
    transactions: result.created.map(txDto),
    installments: result.installments.map(installmentDto),
  });
});
