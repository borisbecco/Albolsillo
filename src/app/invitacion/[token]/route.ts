import { prisma } from "@/lib/db";
import { activeInviteFor } from "@/lib/invites";

// GET /invitacion/:token: link del mail de invitación. Lleva al registro con el email precargado;
// al crear la cuenta con ese email, el contacto queda vinculado.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await prisma.person.findFirst({ where: { inviteToken: token, deletedAt: null }, select: { email: true, status: true } });
  const url = new URL(person?.status === "user" ? "/entrar" : "/registro", req.url);
  if (person?.email) {
    url.searchParams.set("email", person.email);
    // Con registro por invitación, el link trae el código para crear la cuenta.
    const inv = person.status !== "user" ? await activeInviteFor(prisma, person.email) : null;
    if (inv) url.searchParams.set("invite", inv.code);
  }
  return Response.redirect(url, 302);
}
