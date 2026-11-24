import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { LoanFields, loanDto } from "@/lib/loans";

type Ctx = { params: Promise<{ id: string }> };

async function findOwn(userId: string, id: string) {
  const row = await prisma.loan.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos ese préstamo.");
  return row;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const prev = await findOwn(userId, id);
  const l = await readBody(req, LoanFields.partial());
  if ((l.n ?? prev.n) > (l.of ?? prev.of)) throw new ApiError(400, "validation", "Las cuotas pagadas no pueden ser más que el total.");
  const row = await prisma.loan.update({
    where: { id },
    data: { lender: l.lender === undefined ? undefined : l.lender || null, name: l.name, installment: l.installment, dueDay: l.due_day, n: l.n, of: l.of, tna: l.tna, balance: l.balance },
  });
  return Response.json({ loan: loanDto(row) });
});

// Borrado lógico. Las cuotas ya pagadas (movimientos) se conservan.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.loan.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
});
