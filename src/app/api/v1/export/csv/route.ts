import { handle } from "@/lib/http";
import { requireUserId } from "@/lib/auth/session";
import { categoryName, ddmmyyyy, exportRows, parseExportQuery } from "@/lib/export";

// GET /export/csv?month=&type=&category=&account=&q=
// text/csv con BOM, separador ";", columnas Fecha;Descripción;Categoría;Cuenta;Tipo;Moneda;Monto.

const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const GET = handle(async (req: Request) => {
  const userId = await requireUserId(req);
  const f = parseExportQuery(req);
  const rows = await exportRows(userId, f);

  const lines = [
    ["Fecha", "Descripción", "Categoría", "Cuenta", "Tipo", "Moneda", "Monto"].join(";"),
    ...rows.map((t) =>
      [
        ddmmyyyy(t.date),
        t.description,
        categoryName(t.categoryId),
        t.card?.name ?? t.account?.name ?? "",
        t.type === "in" ? "Ingreso" : "Gasto",
        t.currency,
        // Coma decimal para que Excel en español lo lea como número.
        (t.type === "in" ? "" : "-") + t.amount.toFixed(2).replace(".", ","),
      ]
        .map((v) => cell(String(v)))
        .join(";"),
    ),
  ];

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="albolsillo-${f.month}.csv"`,
    },
  });
});
