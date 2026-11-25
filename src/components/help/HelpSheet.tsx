"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HELP, TOUR } from "@/lib/help";
import { viewFromPath } from "@/lib/nav";
import { norm } from "@/lib/entities";
import { useShell } from "@/components/shell/ShellContext";
import t from "@/components/tx/tx.module.css";
import h from "./help.module.css";
import { Bolsi } from "@/components/bolsi/Bolsi";

/** Ayuda: preguntas frecuentes en 6 temas, con buscador sin tildes y el tema de la pantalla actual primero. */
export function HelpSheet() {
  const { setHelpOpen, setTourStep } = useShell();
  const view = viewFromPath(usePathname());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const close = () => setHelpOpen(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHelpOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setHelpOpen]);

  const nq = norm(q);
  const topics = HELP.map((tp) => ({ ...tp, here: tp.views.includes(view) }))
    .sort((a, b) => Number(b.here) - Number(a.here))
    .map((tp) => ({ ...tp, items: tp.qs.map(([qq, aa], k) => ({ id: `${tp.id}${k}`, q: qq, a: aa })).filter((it) => !nq || norm(`${it.q} ${it.a}`).includes(nq)) }))
    .filter((tp) => tp.items.length);

  return (
    <div className={t.backdrop} onClick={close} style={{ zIndex: 40 }}>
      <div className={`${t.sheet} ${h.sheet}`} role="dialog" aria-modal="true" aria-label="Ayuda" onClick={(e) => e.stopPropagation()}>
        <div className={t.top}>
          <span className={h.title}>Ayuda</span>
          <button className={`${t.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={close}>
            close
          </button>
        </div>
        <label className={h.search}>
          <span className="material-symbols-rounded">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué querés hacer?" aria-label="Buscar en la ayuda" autoFocus />
        </label>
        {!nq && (
          <div className={h.tourCard}>
            <Bolsi pose="bienvenida" width={44} height={48} />
            <span className={h.tourText}>
              <strong>Recorrido guiado</strong>
              <span>Te muestro cómo funciona la app en {TOUR.length} pasos.</span>
            </span>
            <button
              className={h.tourBtn}
              onClick={() => {
                close();
                setTourStep(0);
              }}
            >
              Empezar
            </button>
          </div>
        )}
        {topics.map((tp) => (
          <section key={tp.id} className={h.topic}>
            <div className={h.topicHead}>
              <span className="material-symbols-rounded">{tp.icon}</span>
              <strong>{tp.name}</strong>
              {tp.here && !nq && <span className={h.here}>Esta pantalla</span>}
            </div>
            <div className={h.items}>
              {tp.items.map((it) => {
                const isOpen = !!nq || open === it.id;
                return (
                  <div key={it.id} className={h.item}>
                    <button className={h.q} aria-expanded={isOpen} onClick={() => setOpen(open === it.id ? null : it.id)}>
                      <span>{it.q}</span>
                      <span className="material-symbols-rounded" style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>
                        expand_more
                      </span>
                    </button>
                    {isOpen && <p className={h.a}>{it.a}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {!topics.length && <span className={h.empty}>No encontramos nada con “{q}”. Probá con otras palabras.</span>}
      </div>
    </div>
  );
}
