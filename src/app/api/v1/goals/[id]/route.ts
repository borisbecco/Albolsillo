import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { GoalFields, goalDto } from "@/lib/savings";

type Ctx = { params: Promise<{ id: string }> };

async function findOwn(userId: string, id: string) {
  const row = await prisma.goal.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "No encontramos esa meta.");
  return row;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const prev = await findOwn(userId, id);
  const g = await readBody(req, GoalFields.partial());
  const target = g.target ? Number(g.target) : Number(prev.target);
  const row = await prisma.goal.update({
    where: { id },
    data: {
      name: g.name,
      icon: g.icon,
      target: g.target,
      currency: g.currency,
      dueMonth: g.due_month,
      completedAt: Number(prev.saved) >= target ? (prev.completedAt ?? new Date()) : null,
    },
  });
  return Response.json({ goal: goalDto(row) });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  await findOwn(userId, id);
  await prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
});
