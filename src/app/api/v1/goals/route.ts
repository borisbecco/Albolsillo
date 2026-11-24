import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { GoalFields, goalDto } from "@/lib/savings";

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.goal.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return Response.json({ goals: rows.map(goalDto) });
});

export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const g = await readBody(req, GoalFields);
  const row = await prisma.goal.create({
    data: { userId, name: g.name, icon: g.icon, target: g.target, currency: g.currency, dueMonth: g.due_month },
  });
  return Response.json({ goal: goalDto(row) }, { status: 201 });
});
