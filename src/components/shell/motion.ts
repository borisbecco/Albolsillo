"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Movimiento de la navegación: indicador que se desliza entre pestañas y entrada de cada vista.
// Todo con CSS/Web Animations (sin View Transitions): no bloquea toques ni se dibuja sobre el encabezado.

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Dirección de la entrada: x = −1/1 (pestaña a la izquierda/derecha), y = 1 (otra sección). */
export type Dir = { x: number; y: number };

/** Entrada corta de una vista: aparece desde el costado o desde abajo. */
export function enter(el: HTMLElement | null, d: Dir) {
  if (!el || reduced() || typeof el.animate !== "function") return;
  el.animate(
    [
      { opacity: 0, transform: `translate(${d.x * 28}px, ${d.y * 12}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration: d.x ? 280 : 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  );
}

export type Box = { x: number; y: number; w: number; h: number; animate: boolean };

/**
 * Posición del elemento activo (marcado con data-ind="<key>") dentro del contenedor,
 * para mover un indicador absoluto hasta ahí. La primera vez se ubica sin animar.
 */
export function useIndicator<T extends HTMLElement>(activeKey: string, scope = "") {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<Box | null>(null);
  const placed = useRef(false);
  const lastScope = useRef(scope);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    // Otro contenedor (p. ej. las pestañas de otra sección): se ubica sin deslizarse.
    if (lastScope.current !== scope) placed.current = false;
    lastScope.current = scope;
    // slide: se desliza (cambio de pestaña); si no, se acomoda al instante (cambió un tamaño).
    const measure = (slide: boolean) => {
      const el = c.querySelector<HTMLElement>(`[data-ind="${CSS.escape(activeKey)}"]`);
      if (!el) return setBox(null);
      // Posición de diseño (offset*): no la afecta el achique del botón presionado ni el scroll.
      let x = 0;
      let y = 0;
      for (let n: HTMLElement | null = el; n && n !== c; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      // Misma posición: no se toca (así no se corta un deslizamiento en curso).
      setBox((b) => (b && b.x === x && b.y === y && b.w === w && b.h === h ? b : { x, y, w, h, animate: slide }));
    };
    measure(placed.current);
    placed.current = true;
    // Se vuelve a medir si cambia el tamaño del contenedor o de la pestaña activa
    // (p. ej. cuando carga la fuente de los íconos, que antes ocupan como texto).
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(c);
    const target = c.querySelector<HTMLElement>(`[data-ind="${CSS.escape(activeKey)}"]`);
    if (target) ro.observe(target);
    let alive = true;
    void document.fonts?.ready.then(() => alive && measure(false));
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [activeKey, scope]);

  return [ref, box] as const;
}

export const indicatorStyle = (b: Box | null): React.CSSProperties =>
  b
    ? { width: b.w, height: b.h, transform: `translate(${b.x}px, ${b.y}px)`, transition: b.animate ? undefined : "none" }
    : { opacity: 0 };
