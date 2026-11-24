"use client";

import { useData } from "@/components/data/DataContext";
import { useShell } from "@/components/shell/ShellContext";
import a from "./auto.module.css";

/** Aviso en Inicio: "Detectamos N gastos nuevos". */
export function DetectedBanner() {
  const { detected } = useData();
  const { setAutoSheet } = useShell();
  const n = detected.length;
  if (!n) return null;
  const from = [...new Set(detected.map((d) => (d.origin === "mail" ? "tus mails" : "comprobantes compartidos")))];
  return (
    <button className={a.banner} onClick={() => setAutoSheet("detected")}>
      <span className={`${a.bannerIcon} material-symbols-rounded`}>bolt</span>
      <span className={a.bannerText}>
        <strong>{n === 1 ? "Detectamos 1 gasto nuevo" : `Detectamos ${n} gastos nuevos`}</strong>
        <span>Vienen de {from.join(" y ")}. Revisalos antes de sumarlos.</span>
      </span>
      <span className={a.bannerBtn}>Revisar</span>
    </button>
  );
}
