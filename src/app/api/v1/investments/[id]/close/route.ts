import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto } from "@/lib/dto";
import { investmentDto, positive } from "@/lib/savings";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  /** Lo que se acredita (capital + intereses), en la moneda de la inversión. */
  amount: positive,
  /** Cuenta donde se acredita; por defecto, la de origen si tiene la misma moneda. */
  account_id: z.uuid().nullable().optional(),
});

// POST /investments/:id/close: acreditar (plazo fijo), rescatar (FCI) o vender (dólares).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, Body);

  const result = await prisma.$transaction(async (db) => {
    const inv = await db.investment.findFirst({ where: { id, userId, deletedAt: null, closedAt: null } });
    if (!inv) throw new ApiError(404, "not_found", "No encontramos esa inversión.");
    const targetId = b.account_id ?? inv.accountId;
    let acc = await db.account.findFirst({ where: { id: targetId, userId, deletedAt: null } });
    if (acc && acc.currency !== inv.currency) {
      // Si la cuenta de origen es de otra moneda, buscamos una de la moneda de la inversión.
      acc = await db.account.findFirst({ where: { userId, deletedAt: null, currency: inv.currency }, orderBy: { createdAt: "asc" } });
    }
    const closed = await db.investment.update({ where: { id }, data: { closedAt: new Date() } });
    const account = acc ? await db.account.update({ where: { id: acc.id }, data: { balance: { increment: b.amount } } }) : null;
    return { closed, account };
  });

  return Response.json({ investment: investmentDto(result.closed), account: result.account ? accountDto(result.account) : null });
});
