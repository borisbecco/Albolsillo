import { ApiError, errorResponse, handle } from "@/lib/http";
import { clearRefreshCookie, readRefreshCookie, rotateSession } from "@/lib/auth/session";

export const POST = handle(async (req: Request) => {
  try {
    const session = await rotateSession(readRefreshCookie(req));
    return Response.json({ access_token: session.accessToken }, { headers: { "Set-Cookie": session.cookie } });
  } catch (e) {
    if (e instanceof ApiError && e.code === "session_expired") {
      const res = errorResponse(401, e.code, e.message);
      res.headers.set("Set-Cookie", clearRefreshCookie());
      return res;
    }
    throw e;
  }
});
