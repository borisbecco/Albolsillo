import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { personDto } from "@/lib/dto";

type Ctx = { params: Promise<{ id: string }> };

async function findOwn(userId: string, id: string) {
  const row = await prisma.person.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos ese contacto.");
  return row;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  const b = await readBody(req, z.object({ name: z.string().trim().min(1, "Poné un nombre").max(60) }));
  const row = await prisma.person.update({ where: { id }, data: { name: b.name } });
  return Response.json({ person: personDto(row) });
});

// Borrado lógico. Los gastos compartidos con esa persona se conservan.
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.person.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
});
