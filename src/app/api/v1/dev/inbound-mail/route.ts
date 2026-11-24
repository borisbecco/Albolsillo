import { ApiError, handle } from "@/lib/http";
import { handleMail } from "@/lib/auto/inbox";

// POST /dev/inbound-mail: solo para pruebas (INBOX_DEV_ENDPOINT=1). Recibe un mail crudo (RFC 822)
// y lo procesa como si hubiera llegado a la casilla.
export const POST = handle(async (req: Request) => {
  if (process.env.INBOX_DEV_ENDPOINT !== "1") throw new ApiError(404, "not_found", "No existe.");
  const { simpleParser } = await import("mailparser");
  const mail = await simpleParser(Buffer.from(await req.arrayBuffer()));
  return Response.json(await handleMail(mail as unknown as Parameters<typeof handleMail>[0]));
});
