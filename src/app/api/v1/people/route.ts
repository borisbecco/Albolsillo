import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { personDto } from "@/lib/dto";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validate";
import { invitePerson } from "@/lib/shared-invite";

const Create = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  email: z
    .string()
    .trim()
    .refine((e) => !e || isValidEmail(e), "Revisá el email")
    .transform((e) => (e ? normalizeEmail(e) : null))
    .nullable()
    .default(null),
});

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const rows = await prisma.person.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return Response.json({ people: rows.map(personDto) });
});

// POST /people: agrega un contacto. Si viene con email, se le manda la invitación.
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Create);
  const me = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  if (b.email && b.email === me.email) throw new ApiError(400, "validation", "Ese es tu propio email.");
  const person = await prisma.person.create({ data: { userId, name: b.name, email: b.email, status: "contact" } });
  const inv = b.email ? await invitePerson(userId, person.id, b.email) : null;
  return Response.json({ person: personDto(inv?.person ?? person), mail_sent: inv?.mailSent ?? null, link: inv?.link ?? null }, { status: 201 });
});
