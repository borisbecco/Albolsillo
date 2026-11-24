import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { prisma } from "@/lib/db";
import { ApiError, handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { todayAR } from "@/lib/notify";
import { createDetected, detectedDto } from "@/lib/auto/detected";
import { parseNotice, walletFromText } from "@/lib/auto/parse";

const MAX = 8 * 1024 * 1024;

async function pdfText(data: Uint8Array) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

/** OCR en español (tesseract.js; los datos del idioma se bajan una vez y quedan en la carpeta temporal). */
async function imageText(data: Buffer) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, { cachePath: tmpdir() });
  try {
    const { data: r } = await worker.recognize(data);
    return r.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * POST /detected/share (multipart: file): comprobante compartido o subido. Se lee el texto (PDF u OCR),
 * se extraen monto, comercio y fecha, y se crea un gasto detectado. El archivo no se guarda.
 */
export const POST = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new ApiError(400, "validation", "Elegí el comprobante (imagen o PDF).");
  if (file.size > MAX) throw new ApiError(413, "too_large", "El archivo es muy grande (máximo 8 MB).");
  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || buf.subarray(0, 4).toString() === "%PDF";
  if (!isPdf && !file.type.startsWith("image/")) throw new ApiError(415, "unsupported", "Solo leemos imágenes y PDF.");

  const externalId = createHash("sha256").update(buf).digest("hex");
  const already = await prisma.detectedExpense.findFirst({ where: { userId, externalId } });
  if (already) throw new ApiError(409, "already_shared", "Ese comprobante ya lo subiste.");

  let text = "";
  try {
    text = isPdf ? await pdfText(new Uint8Array(buf)) : await imageText(buf);
  } catch (e) {
    console.warn("[share] no se pudo leer", e);
  }
  const wallet = walletFromText(text);
  const parsed = text ? parseNotice(text, wallet) : null;
  if (!parsed) throw new ApiError(422, "unreadable", "No pudimos leer el monto del comprobante. Cargalo a mano con +.");

  const row = await createDetected(prisma, userId, {
    sourceId: null,
    origin: "share",
    externalId,
    wallet: wallet?.wallet ?? null,
    merchant: parsed.merchant ?? wallet?.wallet ?? "Comprobante",
    amount: parsed.amount,
    currency: parsed.currency,
    date: parsed.date ?? todayAR(),
  });
  if (!row) throw new ApiError(409, "already_shared", "Ese comprobante ya lo subiste.");
  return Response.json({ detected: detectedDto(row) }, { status: 201 });
});
