import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { MONTH_FULL } from "@/lib/month";
import { categoryName, ddmmyyyy, exportRows, parseExportQuery } from "@/lib/export";

// GET /export/pdf?month=&scope=filtered|all
// Título "Albolsillo · [Mes] [Año]", usuario, fecha de generación, KPIs, gasto por categoría y movimientos.
// Los montos en dólares se listan en US$ y se suman a los totales convertidos con la cotización elegida por el usuario.

const ACC = "#447BF6";
const INK = "#0A0B0F";
const MUT = "#525A6B";
const LINE = "#E3E8F2";
const POS = "#1F8A5B";
const RED = "#C2414F";

const money = (n: number, cur: "ARS" | "USD" = "ARS") =>
  `${n < 0 ? "-" : ""}${cur === "USD" ? "US$ " : "$ "}${Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const f = parseExportQuery(req);
  const [user, rows] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: userId } }), exportRows(userId, f)]);

  const fx = user.rateType === "manual" ? null : await prisma.fxRate.findUnique({ where: { type: user.rateType } });
  const rate = user.rateType === "manual" ? Number(user.manualRate ?? 0) : Number(fx?.sell ?? 0);
  const toArs = (t: (typeof rows)[number]) => Number(t.amount) * (t.currency === "USD" ? rate : 1);
  const counted = rows.filter((t) => t.currency === "ARS" || rate > 0);
  const inc = counted.filter((t) => t.type === "in").reduce((s, t) => s + toArs(t), 0);
  const out = counted.filter((t) => t.type === "out").reduce((s, t) => s + toArs(t), 0);
  const save = inc ? (inc - out) / inc : 0;
  const byCat = new Map<string, number>();
  for (const t of counted) if (t.type === "out") byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + toArs(t));
  const cats = [...byCat].sort((a, b) => b[1] - a[1]);

  const [y, m] = f.month.split("-");
  const title = `Albolsillo · ${MONTH_FULL[Number(m) - 1]} ${y}`;

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: title, Author: "Albolsillo" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - 96;

  // Encabezado
  doc.fillColor(ACC).font("Helvetica-Bold").fontSize(22).text(title);
  doc
    .moveDown(0.3)
    .fillColor(MUT)
    .font("Helvetica")
    .fontSize(10)
    .text(`${user.name} · ${user.email}`)
    .text(
      `Generado el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())}` +
        (f.scope === "filtered" && (f.type || f.category || f.q || f.account) ? " · con filtros" : "") +
        (rate > 0 && rows.some((t) => t.currency === "USD") ? ` · US$ a ${money(rate)}` : ""),
    );
  doc.moveDown(1);

  // KPIs
  const kpis: [string, string, string][] = [
    ["Ingresos", money(inc), POS],
    ["Gastos", money(-out), INK],
    ["Balance", money(inc - out), inc - out < 0 ? RED : INK],
    ["Tasa de ahorro", inc ? `${Math.round(save * 100)}%` : "—", ACC],
  ];
  const kw = W / 4;
  const ky = doc.y;
  kpis.forEach(([label, value, color], i) => {
    const x = 48 + i * kw;
    doc.roundedRect(x, ky, kw - 8, 54, 8).strokeColor(LINE).lineWidth(1).stroke();
    doc.fillColor(MUT).font("Helvetica").fontSize(9).text(label, x + 10, ky + 10, { width: kw - 28 });
    doc.fillColor(color).font("Helvetica-Bold").fontSize(14).text(value, x + 10, ky + 26, { width: kw - 28 });
  });
  doc.y = ky + 70;
  doc.x = 48;

  // Gasto por categoría
  if (cats.length) {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text("Gasto por categoría");
    doc.moveDown(0.4);
    for (const [id, v] of cats) {
      const yy = doc.y;
      const pct = out ? v / out : 0;
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(categoryName(id), 48, yy, { width: 150 });
      doc.roundedRect(200, yy + 2, (W - 260) * pct + 2, 8, 4).fill(ACC);
      doc.fillColor(MUT).text(`${Math.round(pct * 100)}%`, W - 50, yy, { width: 30, align: "right" });
      doc.fillColor(INK).text(money(v), W - 10, yy, { width: 58, align: "right" });
      doc.y = yy + 16;
    }
    doc.moveDown(1);
  }

  // Movimientos
  doc.x = 48;
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text(`Movimientos (${rows.length})`);
  doc.moveDown(0.4);
  // Fecha · Descripción · Categoría · Cuenta · Monto (alineado a la derecha)
  const cols = [48, 110, 262, 368, 48 + W - 90];
  const header = () => {
    const yy = doc.y;
    doc.fillColor(MUT).font("Helvetica-Bold").fontSize(9);
    ["Fecha", "Descripción", "Categoría", "Cuenta", "Monto"].forEach((h, i) =>
      doc.text(h, cols[i], yy, { width: i === 4 ? 90 : cols[i + 1] - cols[i] - 8, align: i === 4 ? "right" : "left" }),
    );
    doc.moveTo(48, yy + 13).lineTo(48 + W, yy + 13).strokeColor(LINE).stroke();
    doc.y = yy + 18;
  };
  header();
  for (const t of rows) {
    if (doc.y > doc.page.height - 70) {
      doc.addPage();
      header();
    }
    const yy = doc.y;
    const amount = (t.type === "in" ? 1 : -1) * Number(t.amount);
    doc.fillColor(INK).font("Helvetica").fontSize(9);
    doc.text(ddmmyyyy(t.date), cols[0], yy, { width: 58 });
    doc.text(t.description, cols[1], yy, { width: cols[2] - cols[1] - 8, height: 11, lineBreak: false, ellipsis: true });
    doc.fillColor(MUT).text(categoryName(t.categoryId), cols[2], yy, { width: cols[3] - cols[2] - 8, height: 11, lineBreak: false, ellipsis: true });
    doc.text(t.card?.name ?? t.account?.name ?? "—", cols[3], yy, { width: cols[4] - cols[3] - 8, height: 11, lineBreak: false, ellipsis: true });
    doc.fillColor(amount > 0 ? POS : INK).text(money(amount, t.currency), cols[4], yy, { width: 90, align: "right" });
    doc.y = yy + 15;
  }
  if (!rows.length) doc.fillColor(MUT).font("Helvetica").fontSize(10).text("Sin movimientos en este mes.");

  doc.moveDown(2);
  doc.fillColor(MUT).font("Helvetica").fontSize(8).text("Directo Albolsillo. · albolsillo.app", 48, doc.y, { width: W, align: "center" });
  doc.end();

  const pdf = await done;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="albolsillo-${f.month}.pdf"`,
    },
  });
});
