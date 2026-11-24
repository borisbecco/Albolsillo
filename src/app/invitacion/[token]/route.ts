import { prisma } from "@/lib/db";

// GET /invitacion/:token: link del mail de invitación. Lleva al registro con el email precargado;
// al crear la cuenta con ese email, el contacto queda vinculado.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await prisma.person.findFirst({ where: { inviteToken: token, deletedAt: null }, select: { email: true, status: true } });
  const url = new URL(person?.status === "user" ? "/entrar" : "/registro", req.url);
  if (person?.email) url.searchParams.set("email", person.email);
  return Response.redirect(url, 302);
}
