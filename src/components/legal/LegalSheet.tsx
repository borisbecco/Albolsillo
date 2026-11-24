"use client";

import { useEffect } from "react";
import t from "@/components/tx/tx.module.css";
import l from "./legal.module.css";

export type LegalTab = "terms" | "privacy";

const UPDATED = "Última actualización: 24 de noviembre de 2026";

const TERMS: [string, string[]][] = [
  ["Qué es Albolsillo", ["Una app para ordenar tus finanzas personales: gastos, ingresos, tarjetas, metas y deudas. La usamos un grupo de conocidos y se accede solo por invitación."]],
  [
    "Tu cuenta",
    [
      "Sos responsable de tu contraseña y de lo que cargás. Si alguien entra a tu cuenta sin permiso, avisanos.",
      "Cada invitación es para una persona. Si alguien usa mal la app, podemos cerrar su cuenta.",
    ],
  ],
  [
    "Qué no es",
    [
      "Albolsillo no es un banco ni una billetera: no mueve plata ni hace pagos. Los cálculos (plan del mes, inflación, cuotas) son orientativos y no son asesoramiento financiero.",
    ],
  ],
  [
    "Carga automática",
    ["Los gastos que llegan por reenvío de mails o comprobantes se leen de forma automática y pueden tener errores. Por eso nunca se suman sin que los confirmes."],
  ],
  [
    "Disponibilidad",
    [
      "Es un proyecto personal sin costo. Hacemos lo posible para que funcione y no se pierdan datos, pero no garantizamos que esté siempre disponible. Te recomendamos exportar tus datos cada tanto.",
    ],
  ],
  ["Cambios", ["Si cambiamos estos términos, te avisamos por mail antes de que rijan."]],
];

const PRIVACY: [string, string[]][] = [
  [
    "Qué guardamos",
    [
      "Tu nombre, email y contraseña (cifrada). Lo que cargás: movimientos, cuentas, tarjetas, metas, deudas y gastos compartidos.",
      "De los mails reenviados guardamos solo el monto, el comercio, la fecha y la billetera. El mail completo se borra apenas lo leemos.",
      "De los comprobantes subidos, lo mismo. El archivo se borra después de leerlo, salvo que lo adjuntes a un movimiento.",
    ],
  ],
  [
    "Qué no hacemos",
    [
      "No pedimos acceso a tu casilla de mail ni a tus cuentas bancarias.",
      "No vendemos ni compartimos tus datos. No usamos publicidad ni herramientas de seguimiento.",
    ],
  ],
  [
    "Con quién se comparte",
    [
      "Con las personas con las que dividís un gasto compartido, solo ese gasto.",
      "Con los servicios que hacen funcionar la app (servidor, base de datos y envío de mails), que no pueden usar tus datos para otra cosa.",
    ],
  ],
  [
    "Tus derechos",
    [
      "Podés exportar todo desde Movimientos › Exportar y borrar tu cuenta desde Perfil. Al borrarla eliminamos tus datos en un plazo de 30 días, incluidas las copias de seguridad.",
      "La Ley 25.326 de Protección de Datos Personales te da derecho a acceder, corregir y suprimir tus datos. La Agencia de Acceso a la Información Pública es el organismo de control.",
    ],
  ],
  ["Contacto", ["Para cualquier consulta sobre tus datos, escribinos a privacidad@albolsillo.app."]],
];

/** Términos y privacidad, en una hoja con dos pestañas (desde el registro y desde Perfil). */
export function LegalSheet({ tab, onTab, onClose }: { tab: LegalTab; onTab: (t: LegalTab) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const doc = tab === "terms" ? { title: "Términos de uso", body: TERMS } : { title: "Política de privacidad", body: PRIVACY };
  return (
    <div className={t.backdrop} onClick={onClose} style={{ zIndex: 45 }}>
      <div className={`${t.sheet} ${l.sheet}`} role="dialog" aria-modal="true" aria-label={doc.title} onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <div className={l.tabs} role="tablist">
            {(
              [
                ["terms", "Términos"],
                ["privacy", "Privacidad"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} role="tab" type="button" aria-selected={tab === v} onClick={() => onTab(v)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={onClose}>
            close
          </button>
        </div>
        <div className={l.head}>
          <h2>{doc.title}</h2>
          <span>{UPDATED}</span>
        </div>
        {doc.body.map(([h, ps]) => (
          <section key={h} className={l.section}>
            <h3>{h}</h3>
            {ps.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
