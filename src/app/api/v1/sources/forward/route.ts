import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { newAddressCode } from "@/lib/auto/detected";
import { sourceDto } from "@/lib/auto/sources";

/** POST /sources/forward: crea (o devuelve) la dirección de reenvío del usuario. */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const existing = await prisma.expenseSource.findFirst({ where: { userId, kind: "forward", status: { not: "disabled" } } });
  if (existing) return Response.json({ source: sourceDto(existing), address: sourceDto(existing).address });
  const row = await prisma.expenseSource.create({ data: { userId, kind: "forward", addressCode: await newAddressCode(prisma) } });
  return Response.json({ source: sourceDto(row), address: sourceDto(row).address }, { status: 201 });
});
