"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TOUR } from "@/lib/help";
import { VIEWS } from "@/lib/nav";
import { useShell } from "@/components/shell/ShellContext";
import { useData } from "@/components/data/DataContext";
import h from "./help.module.css";
import { Bolsi } from "@/components/bolsi/Bolsi";

type Rect = { top: number; left: number; width: number; height: number };

/** Elemento visible marcado con data-tour (las páginas anteriores quedan ocultas en el DOM). */
function findTarget(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && el.checkVisibility?.() !== false) return el;
  }
  return null;
}

/** Recorrido guiado: 7 pasos que resaltan elementos de la app. Se marca como visto al terminar o saltar. */
export function Tour() {
  const { tourStep, setTourStep, updatePrefs, flash } = useShell();
  const { demo } = useData();
  const router = useRouter();
  const pathname = usePathname();
  const [rect, setRect] = useState<Rect | null>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const step = tourStep !== null ? TOUR[tourStep] : null;

  const finish = useCallback(
    (completed: boolean) => {
      setTourStep(null);
      setRect(null);
      void updatePrefs({ tour_done: true });
      if (completed) flash("¡Listo! Si te olvidás de algo, tocá Ayuda.", "meta");
    },
    [setTourStep, updatePrefs, flash],
  );

  // Ir a la pantalla del paso.
  useEffect(() => {
    if (!step) return;
    const href = VIEWS[step.view].href;
    if (pathname !== href) router.push(href);
  }, [step, pathname, router]);

  // Medir (con reintentos mientras carga la pantalla) y llevar el elemento a la vista.
  useEffect(() => {
    if (!step) return;
    let scrolled = false;
    const measure = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight });
      const el = findTarget(step.target);
      if (!el) return setRect(null);
      let r = el.getBoundingClientRect();
      if (!scrolled && (r.top < 70 || r.bottom > window.innerHeight - 240)) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        r = el.getBoundingClientRect();
      }
      setRect({ top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) });
    };
    const timers = [80, 300, 700, 1200].map((ms) => setTimeout(measure, ms));
    window.addEventListener("resize", measure);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", measure);
    };
  }, [step, pathname]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "ArrowRight") setTourStep(tourStep! + 1 < TOUR.length ? tourStep! + 1 : null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, tourStep, setTourStep, finish]);

  if (!step || tourStep === null) return null;
  const i = tourStep;
  const mobile = size.w < 760;
  const tw = mobile ? size.w - 24 : 360;
  const pad = 8;
  const box: React.CSSProperties = { width: tw, left: mobile ? 12 : Math.round((size.w - tw) / 2) };
  if (rect) {
    const below = rect.top + rect.height + pad + 12;
    if (size.h - below >= 230) box.top = below;
    else if (rect.top - pad - 12 >= 230) box.bottom = size.h - rect.top + pad + 12;
    else box.bottom = mobile ? 84 : 16;
    if (!mobile) box.left = Math.max(12, Math.min(size.w - tw - 12, Math.round(rect.left + rect.width / 2 - tw / 2)));
  } else box.top = Math.max(12, Math.round(size.h / 2 - 110));

  const next = () => (i + 1 < TOUR.length ? setTourStep(i + 1) : finish(true));
  return (
    <div className={h.tourLayer}>
      {rect ? (
        <div
          className={h.tourSpot}
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: Math.min(rect.height + pad * 2, size.h - Math.max(0, rect.top - pad) - 8) }}
        />
      ) : (
        <div className={h.tourDim} />
      )}
      <div className={h.tourBox} style={box} role="dialog" aria-label="Recorrido guiado">
        <div className={h.tourTop}>
          <Bolsi key={step.bolsi} pose={step.bolsi} width={52} height={57} />
          <div className={h.tourCopy}>
            <span className={h.tourStep}>
              PASO {i + 1} DE {TOUR.length}
              {demo && <span className={h.demoTag}>Datos de ejemplo</span>}
            </span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </div>
        </div>
        <div className={h.tourFoot}>
          <div className={h.dots} aria-hidden>
            {TOUR.map((_, k) => (
              <span key={k} style={{ width: k === i ? 18 : 6, background: k <= i ? "var(--acc)" : "var(--line2)" }} />
            ))}
          </div>
          <button className={h.skip} onClick={() => finish(false)}>
            Saltar
          </button>
          {i > 0 && (
            <button className={h.prev} onClick={() => setTourStep(i - 1)}>
              Anterior
            </button>
          )}
          <button className={h.next} onClick={next} autoFocus>
            {i === TOUR.length - 1 ? "Terminar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
