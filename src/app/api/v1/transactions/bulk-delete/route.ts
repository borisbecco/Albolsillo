import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { deleteTransactions, undoToken } from "@/lib/tx-delete";

const Body = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

/** POST /transactions/bulk-delete { ids } → { undo_token } */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const { ids } = await readBody(req, Body);
  const rows = await prisma.$transaction((db) => deleteTransactions(db, userId, ids), { timeout: 30_000 });
  return Response.json({ deleted: rows.map((r) => r.id), undo_token: undoToken(userId, rows.map((r) => r.id)) });
});
