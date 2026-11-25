import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { cardDto, installmentDto } from "@/lib/dto";
import { undoCloseCycle, type CycleSnapshot } from "@/lib/cards";
import { readSignedToken } from "@/lib/tx-delete";

type Ctx = { params: Promise<{ id: string }> };

/** POST /cards/:id/statements/undo { undo_token }: deshace la carga del último resumen. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const { undo_token } = await readBody(req, z.object({ undo_token: z.string().min(10) }));
  const snapshot = readSignedToken<CycleSnapshot>(userId, `stmt:${id}`, undo_token);

  const result = await prisma.$transaction(async (db) => {
    const card = await db.card.findFirst({ where: { id, userId, deletedAt: null } });
    if (!card) throw new ApiError(404, "not_found", "No encontramos esa tarjeta.");
    // Si ya se cargó otro resumen después, no se puede volver atrás este.
    const last = await db.cardStatement.findFirst({ where: { cardId: id }, orderBy: { createdAt: "desc" } });
    if (last?.id !== snapshot.statementId) throw new ApiError(422, "undo_invalid", "Ya no se puede deshacer: cargaste otro resumen después.");
    await undoCloseCycle(db, id, userId, snapshot);
    const updated = await db.card.findUniqueOrThrow({ where: { id } });
    const installments = await db.cardInstallment.findMany({ where: { cardId: id, deletedAt: null, cancelledAt: null }, orderBy: { createdAt: "asc" } });
    return { updated, installments };
  });

  return Response.json({ card: cardDto(result.updated), installments: result.installments.map(installmentDto), removed: snapshot.created });
});
