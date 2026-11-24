import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { cardDto } from "@/lib/dto";

type Ctx = { params: Promise<{ id: string }> };

/** POST /cards/:id/restore: deshace el borrado de una tarjeta. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const card = await prisma.card.findFirst({ where: { id, userId, deletedAt: { not: null } } });
  if (!card) throw new ApiError(404, "not_found", "No encontramos esa tarjeta.");
  const row = await prisma.card.update({ where: { id }, data: { deletedAt: null } });
  return Response.json({ card: cardDto(row) });
});
