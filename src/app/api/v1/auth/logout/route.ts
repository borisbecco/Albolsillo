import { handle } from "@/lib/http";
import { clearRefreshCookie, readRefreshCookie, revokeSession } from "@/lib/auth/session";

export const POST = handle(async (req: Request) => {
  await revokeSession(readRefreshCookie(req));
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearRefreshCookie() } });
});
