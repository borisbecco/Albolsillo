import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { sharedDto } from "@/lib/shared";
import { toDate } from "@/lib/transactions";

const Body = z.object({
  person_id: z.uuid(),
  /** > 0: la persona le pagó al usuario ("Me pagó"); < 0: el usuario le pagó ("Le pagué"). */
  amount: z
    .string()
    .regex(/^-?\d{1,12}(\.\d{1,2})?$/)
    .refine((v) => Number(v) !== 0, "Ingresá un monto"),
  date: z.iso.date().optional(),
});

// POST /shared/settle: registra que quedaron a mano (o un pago parcial).
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Body);
  const person = await prisma.person.findFirst({ where: { id: b.person_id, userId, deletedAt: null } });
  if (!person) throw new ApiError(404, "not_found", "No encontramos ese contacto.");
  const row = await prisma.sharedExpense.create({
    data: {
      userId,
      kind: "settlement",
      description: Number(b.amount) > 0 ? `${person.name} te pagó` : `Le pagaste a ${person.name}`,
      date: toDate(b.date ?? new Date().toISOString().slice(0, 10)),
      total: Math.abs(Number(b.amount)).toFixed(2),
      currency: "ARS",
      paidBy: Number(b.amount) > 0 ? person.id : "me",
      participants: ["me", person.id],
      settlePersonId: person.id,
      settleAmount: b.amount,
    },
  });
  return Response.json({ shared: sharedDto(row) }, { status: 201 });
});
