import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { accountDto } from "@/lib/dto";
import { AccountKind, AccountName, Balance } from "@/lib/accounts";

type Ctx = { params: Promise<{ id: string }> };

// La moneda no se cambia: los movimientos y transferencias ya cargados están en esa moneda.
const Patch = z.object({ name: AccountName, kind: AccountKind, balance: Balance }).partial();

async function findOwn(userId: string, id: string) {
  const row = await prisma.account.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos esa cuenta.");
  return row;
}

// PATCH /accounts/:id. Cambiar el saldo a mano es un ajuste: no crea movimiento.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  const b = await readBody(req, Patch);
  const row = await prisma.account.update({ where: { id }, data: { name: b.name, kind: b.kind, balance: b.balance } });
  return Response.json({ account: accountDto(row) });
});

// DELETE /accounts/:id (lógico). Los movimientos ya cargados se conservan.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.account.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
});
