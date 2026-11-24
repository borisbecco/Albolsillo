import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handle, readBody } from "@/lib/http";
import { requireUserId, toUserDto } from "@/lib/auth/session";

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new ApiError(401, "session_expired", "Tu sesión venció.");
  return Response.json({ user: toUserDto(user) });
});

// Preferencias del usuario.
const Patch = z
  .object({
    name: z.string().trim().min(1, "Contanos cómo te llamás").max(80),
    theme: z.enum(["dark", "light"]),
    display_currency: z.enum(["ARS", "USD"]),
    rate_type: z.enum(["oficial", "blue", "bolsa", "tarjeta", "manual"]),
    manual_rate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Ingresá una cotización válida").nullable(),
    pay_strategy: z.enum(["intereses", "avalancha", "bola"]),
    alert_days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
    mail_alerts: z.enum(["off", "each", "daily"]),
    last_month_opened: z.string().regex(/^\d{4}-\d{2}$/),
  })
  .partial();

export const PATCH = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const b = await readBody(req, Patch);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: b.name,
      theme: b.theme,
      displayCurrency: b.display_currency,
      rateType: b.rate_type,
      manualRate: b.manual_rate,
      payStrategy: b.pay_strategy,
      alertDays: b.alert_days,
      mailAlerts: b.mail_alerts,
      lastMonthOpened: b.last_month_opened,
    },
  });
  return Response.json({ user: toUserDto(user) });
});
