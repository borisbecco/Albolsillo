import { ApiError, handle } from "@/lib/http";
import { cronAuthorized } from "@/lib/cron";
import { runInbox } from "@/lib/auto/inbox";

// POST /cron/inbox: cada 5 minutos lee la casilla de reenvío y crea los gastos detectados.
export const POST = handle(async (req: Request) => {
  if (!cronAuthorized(req)) throw new ApiError(401, "unauthorized", "No autorizado.");
  return Response.json(await runInbox());
});
