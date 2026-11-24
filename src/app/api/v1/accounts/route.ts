import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto } from "@/lib/dto";
import { AccountKind, AccountName, Balance } from "@/lib/accounts";

const Create = z.object({
  name: AccountName,
  kind: AccountKind,
  currency: z.enum(["ARS", "USD"]),
  balance: Balance.default("0"),
});

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.account.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return Response.json({ accounts: rows.map(accountDto) });
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Create);
  const row = await prisma.account.create({ data: { userId, name: b.name, kind: b.kind, currency: b.currency, balance: b.balance } });
  return Response.json({ account: accountDto(row) }, { status: 201 });
});
