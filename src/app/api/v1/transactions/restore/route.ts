import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, readBody } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { readUndoToken, restoreTransactions } from "@/lib/tx-delete";

const Body = z.object({ undo_token: z.string().min(10).max(40_000) });

/** POST /transactions/restore { undo_token } → { restored: [ids] } (válido 24 h) */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const { undo_token } = await readBody(req, Body);
  const ids = readUndoToken(userId, undo_token);
  const restored = await prisma.$transaction((db) => restoreTransactions(db, userId, ids), { timeout: 30_000 });
  return Response.json({ restored });
});
