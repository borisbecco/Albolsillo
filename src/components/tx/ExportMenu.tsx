"use client";

import { useEffect, useRef, useState } from "react";
import { ApiClientError, download } from "@/lib/api-client";
import { useShell } from "@/components/shell/ShellContext";
import m from "./movements.module.css";

/** Botón "Exportar" con CSV y PDF del mes (con los filtros de Movimientos). */
export function ExportMenu({ query }: { query: Record<string, string | undefined> }) {
  const { month, flash } = useShell();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const qs = new URLSearchParams(Object.entries({ month, ...query }).filter((e): e is [string, string] => !!e[1])).toString();

  const get = async (kind: "csv" | "pdf") => {
    setOpen(false);
    try {
      await download(`/export/${kind}?${qs}`, `albolsillo-${month}.${kind}`);
      flash(kind === "csv" ? "Descargamos el CSV" : "Descargamos el PDF");
    } catch (e) {
      flash(e instanceof ApiClientError ? e.message : "No pudimos generar el archivo.", "errorguardar");
    }
  };

  return (
    <div className={m.exportWrap} ref={ref}>
      <button className={m.exportBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="material-symbols-rounded">download</span>
        Exportar
      </button>
      {open && (
        <div className={m.exportMenu} role="menu">
          <button role="menuitem" onClick={() => get("csv")}>
            <span className="material-symbols-rounded" style={{ color: "var(--pos)" }}>
              table_view
            </span>
            <span>
              <strong>CSV</strong>
              <small>Para Excel o Google Sheets</small>
            </span>
          </button>
          <button role="menuitem" onClick={() => get("pdf")}>
            <span className="material-symbols-rounded" style={{ color: "var(--red)" }}>
              picture_as_pdf
            </span>
            <span>
              <strong>PDF</strong>
              <small>Resumen y movimientos filtrados</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
