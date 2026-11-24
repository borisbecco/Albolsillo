import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

type Ctx = { params: Promise<{ id: string }> };

/** POST /detected/:id/discard: lo saca de la bandeja (si vuelve a llegar el mismo mail, no se crea de nuevo). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const d = await prisma.detectedExpense.findFirst({ where: { id, userId, status: "pending" } });
  if (!d) throw new ApiError(404, "not_found", "No encontramos ese gasto.");
  await prisma.detectedExpense.update({ where: { id }, data: { status: "discarded" } });
  return new Response(null, { status: 204 });
});
