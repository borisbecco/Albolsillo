import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { BANK_BY_ID } from "@/lib/banks";
import { parseStatement } from "@/lib/import/statement";
import { rateLimit } from "@/lib/rate-limit";
import { rulesMap } from "@/lib/rules";
import { merchantKey } from "@/lib/merchant-key";

const MAX_BYTES = 10 * 1024 * 1024;

// POST /imports (multipart: card_id, file): lee el resumen PDF y devuelve las filas para revisar.
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  // Leer PDFs e imágenes (OCR) consume mucho: pocos por minuto.
  rateLimit(`import:${userId}`, 10);
  const form = await req.formData().catch(() => null);
  const cardId = form?.get("card_id");
  const file = form?.get("file");
  if (typeof cardId !== "string" || !(file instanceof File)) throw new ApiError(400, "validation", "Elegí la tarjeta y el PDF del resumen.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "too_large", "El archivo es muy grande (máximo 10 MB).");

  const card = await prisma.card.findFirst({ where: { id: cardId, userId, deletedAt: null } });
  if (!card) throw new ApiError(404, "not_found", "No encontramos esa tarjeta.");

  const data = new Uint8Array(await file.arrayBuffer());
  if (Buffer.from(data.subarray(0, 5)).toString() !== "%PDF-") throw new ApiError(415, "not_pdf", "El archivo no es un PDF.");

  const fileHash = createHash("sha256").update(data).digest("hex");
  const previous = await prisma.import.findUnique({ where: { userId_fileHash: { userId, fileHash } } });
  if (previous?.status === "confirmed") throw new ApiError(409, "already_imported", "Ya importaste este resumen.");

  let parsed;
  try {
    parsed = await parseStatement(data);
  } catch {
    throw new ApiError(422, "parse_failed", "No pudimos leer el PDF. Probá con el resumen original que descargaste del banco.");
  }
  const bank = parsed.bank ?? card.bank;
  if (!parsed.rows.length) {
    const name = bank ? BANK_BY_ID[bank].name : null;
    throw new ApiError(422, "parse_failed", name ? `Detectamos un resumen de ${name}, pero no encontramos movimientos.` : "No encontramos movimientos en el archivo.");
  }

  // Duplicados: misma tarjeta, misma fecha y mismo monto que un movimiento ya cargado.
  const dates = [...new Set(parsed.rows.map((r) => r.date))].map((d) => new Date(`${d}T00:00:00Z`));
  const existing = await prisma.transaction.findMany({
    where: { userId, cardId, deletedAt: null, date: { in: dates } },
    select: { date: true, grossAmount: true },
  });
  const seen = new Set(existing.map((t) => `${t.date.toISOString().slice(0, 10)}|${t.grossAmount.toFixed(2)}`));
  // Categorías aprendidas: si ya elegiste una para ese comercio, se sugiere esa.
  const rules = await rulesMap(prisma, userId);
  const rows = parsed.rows.map((r) => {
    const learned = r.kind === "purchase" || r.kind === "installment" ? rules.get(merchantKey(r.description)) : undefined;
    return { ...r, ...(learned && { suggested_category: learned, learned: true }), duplicate: seen.has(`${r.date}|${r.amount}`) };
  });

  const data$ = {
    bank,
    fileName: file.name.slice(0, 200),
    period: parsed.period,
    status: "parsed" as const,
    rowsTotal: rows.length,
    rows: { rows, summary: { close_date: parsed.close_date, next_close_date: parsed.next_close_date, due_date: parsed.due_date, balance_ars: parsed.balance_ars, balance_usd: parsed.balance_usd, min_payment: parsed.min_payment } },
  };
  const imp = previous
    ? await prisma.import.update({ where: { id: previous.id }, data: { ...data$, cardId, deletedAt: null } })
    : await prisma.import.create({ data: { userId, cardId, fileHash, ...data$ } });

  return Response.json(
    {
      import_id: imp.id,
      bank,
      period: parsed.period,
      close_date: parsed.close_date,
      due_date: parsed.due_date,
      balance_ars: parsed.balance_ars,
      balance_usd: parsed.balance_usd,
      min_payment: parsed.min_payment,
      rows,
    },
    { status: 201 },
  );
});
