import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, clientIp, handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { personDto } from "@/lib/dto";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validate";
import { invitePerson } from "@/lib/shared-invite";
import { rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  email: z.string().refine(isValidEmail, "Revisá el email").transform(normalizeEmail).optional(),
});

// POST /people/:id/invite: manda (o reenvía) el mail "invitacion".
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { id } = await params;
  const b = await readBody(req, Body);
  rateLimit(`invite:${clientIp(req)}:${userId}`, 10);
  const person = await prisma.person.findFirst({ where: { id, userId, deletedAt: null } });
  if (!person) throw new ApiError(404, "not_found", "No encontramos ese contacto.");
  const email = b.email ?? person.email;
  if (!email) throw new ApiError(400, "validation", "Ingresá el email para invitar.");
  const r = await invitePerson(userId, id, email);
  return Response.json({ person: personDto(r.person), mail_sent: r.mailSent, link: r.link });
});
