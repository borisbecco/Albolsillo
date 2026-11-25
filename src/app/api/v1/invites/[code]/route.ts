import { prisma } from "@/lib/db";
import { ApiError, handle, clientIp } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { findValidInvite, inviteDto } from "@/lib/invites";
import { rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ code: string }> };

/** GET /invites/:code (sin sesión): valida el código para el registro. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  // Público (pantalla de registro): con límite para que no se puedan probar códigos al azar.
  rateLimit(`invite-check:${clientIp(req)}`, 30);
  const { code } = await params;
  const inv = await findValidInvite(prisma, code);
  if (!inv) return Response.json({ valid: false, inviter_name: null });
  const inviter = inv.inviterId ? await prisma.user.findUnique({ where: { id: inv.inviterId }, select: { name: true } }) : null;
  return Response.json({ valid: true, inviter_name: inviter?.name ?? null, email: inv.email });
});

/** DELETE /invites/:id: anula una invitación pendiente (no devuelve el cupo). */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const userId = await requireUserId(req);
  const { code: id } = await params;
  const inv = await prisma.invite.findFirst({ where: { id, inviterId: userId } });
  if (!inv) throw new ApiError(404, "not_found", "No encontramos esa invitación.");
  if (inv.status !== "pending") throw new ApiError(409, "not_pending", "Esa invitación ya no está pendiente.");
  const row = await prisma.invite.update({ where: { id }, data: { status: "cancelled" } });
  return Response.json({ invite: inviteDto(row) });
});
