import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId, toUserDto } from "@/lib/auth/session";

const Body = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

// POST /me/push: guarda la suscripción del navegador y activa los avisos push.
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: b.endpoint },
    update: { userId, p256dh: b.keys.p256dh, auth: b.keys.auth },
    create: { userId, endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth },
  });
  const user = await prisma.user.update({ where: { id: userId }, data: { pushEnabled: true } });
  return Response.json({ user: toUserDto(user) });
});

// DELETE /me/push: desactiva los avisos push y borra las suscripciones.
export const DELETE = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  const user = await prisma.user.update({ where: { id: userId }, data: { pushEnabled: false } });
  return Response.json({ user: toUserDto(user) });
});
