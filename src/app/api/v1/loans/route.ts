import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { LoanFields, loanDto } from "@/lib/loans";

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.loan.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return Response.json({ loans: rows.map(loanDto) });
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const l = await readBody(req, LoanFields);
  if (l.n > l.of) throw new ApiError(400, "validation", "Las cuotas pagadas no pueden ser más que el total.");
  const row = await prisma.loan.create({
    data: { userId, name: l.name, installment: l.installment, dueDay: l.due_day, n: l.n, of: l.of, tna: l.tna, balance: l.balance },
  });
  return Response.json({ loan: loanDto(row) }, { status: 201 });
});
