import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { loanDto } from "@/lib/loans";

type Ctx = { params: Promise<{ id: string }> };

/** POST /loans/:id/restore: deshace el borrado de un préstamo. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const loan = await prisma.loan.findFirst({ where: { id, userId, deletedAt: { not: null } } });
  if (!loan) throw new ApiError(404, "not_found", "No encontramos ese préstamo.");
  const row = await prisma.loan.update({ where: { id }, data: { deletedAt: null } });
  return Response.json({ loan: loanDto(row) });
});
