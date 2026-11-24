import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";

/** POST /sources/notify-android { on }: anota (o saca) al usuario de la lista para la app de Android. */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const { on } = await readBody(req, z.object({ on: z.boolean().default(true) }));
  await prisma.user.update({ where: { id: userId }, data: { androidWaitlist: on } });
  return Response.json({ android_waitlist: on });
});
