"use client";

import { useEffect, useRef, type CSSProperties } from "react";

// Bolsi animado (MARCA.md › "Bolsi: animaciones"). Inserta el SVG de la pose en un shadow root
// (para que sus clases y keyframes no se mezclen con la app) y le aplica la coreografía del prototipo
// (prototipo/bolsi.js). Mientras carga se ve la pose quieta como imagen. Para reiniciar una animación
// de una sola vez, cambiá la key del componente.

export type BolsiPose = "bienvenida" | "ingreso" | "gasto" | "meta" | "alerta" | "cargando" | "errorcarga" | "sinconexion" | "errorguardar" | "sesion";

const E = "cubic-bezier(.2,.8,.2,1)";
const BASE = `:host{display:inline-block;line-height:0}svg{width:100%;height:100%;display:block;overflow:visible}
.bob,.squash,.body,.flap,.eyes,.eye,.dol,.dol-glow,.coin,.spark,.happy,.alert,.q,.wifi,.slash,.z,.lock,.scan,.shadow{transform-box:fill-box;transform-origin:50% 50%}
.squash{transform-origin:50% 100%}`;
const rm = (x = "") => `@media (prefers-reduced-motion:reduce){*{animation:none!important}${x}}`;

const POSE: Record<BolsiPose, string> = {
  bienvenida:
    `.bob{animation:bob 3.2s ease-in-out infinite}.shadow{animation:sh 3.2s ease-in-out infinite}
.eye{animation:blink 3.2s infinite}.dol-glow{animation:pulse 3.2s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-7px)}}@keyframes sh{50%{transform:scale(.85);opacity:.3}}
@keyframes blink{0%,44%,52%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}` + rm(),
  ingreso:
    `.cin{animation:cin 2.4s ${E} both}.squash{animation:inf 2.4s ${E} both}.eye{animation:smile 2.4s ${E} both}.dol-glow{animation:glow 2.4s ease-in-out both}
@keyframes cin{0%{transform:translateY(-24px);opacity:0}15%{opacity:1;transform:translateY(-8px)}40%{transform:translateY(46px) scale(.7);opacity:1}48%,100%{transform:translateY(52px) scale(.5);opacity:0}}
@keyframes inf{0%,42%,100%{transform:scale(1)}55%{transform:scale(1.08,1.1)}68%{transform:scale(.98,.97)}80%{transform:scale(1.03,1.04)}}
@keyframes smile{0%,45%,92%,100%{transform:scaleY(1)}55%,85%{transform:scaleY(.45) translateY(-2px)}}
@keyframes glow{0%,40%,100%{opacity:.6}60%,80%{opacity:1}}` + rm(".cin{opacity:0}"),
  gasto:
    `.cout{animation:cout 2.4s ${E} both}.squash{animation:def 2.4s ${E} both}.eye{animation:sq 2.4s ${E} both}.dol-glow{animation:dim 2.4s ease-in-out both}
@keyframes cout{0%,10%{transform:translateY(50px) scale(.5);opacity:0}25%{opacity:1}60%{transform:translateY(-6px) scale(1);opacity:1}80%,100%{transform:translateY(-22px);opacity:0}}
@keyframes def{0%,15%,100%{transform:scale(1)}40%,75%{transform:scale(.97,.93)}}
@keyframes sq{0%,20%,88%,100%{transform:scaleY(1)}38%,78%{transform:scaleY(.4)}}
@keyframes dim{0%,15%,100%{opacity:.6}40%,78%{opacity:.12}}` + rm(".cout{opacity:0}"),
  meta:
    `.bob{animation:jump 2.6s ${E} both}.squash{animation:land 2.6s ${E} both}.shadow{animation:sh 2.6s ${E} both}
.happy{animation:hap 2.6s ease both}.eyes{animation:eyesoff 2.6s ease both}.dol-glow{animation:max 2.6s ease both}
.spark{animation:spark 2.6s ${E} both}.s2{animation-delay:.12s}.s3{animation-delay:.22s}.s4{animation-delay:.32s}
@keyframes jump{0%,12%,62%,100%{transform:translateY(0)}35%{transform:translateY(-24px)}}
@keyframes land{0%,100%{transform:scale(1)}10%{transform:scale(1.06,.92)}62%{transform:scale(1.08,.9)}72%{transform:scale(.97,1.04)}}
@keyframes sh{35%{transform:scale(.7);opacity:.2}}
@keyframes hap{0%,25%{opacity:0}35%,90%{opacity:1}100%{opacity:0}}@keyframes eyesoff{0%,25%{opacity:1}35%,90%{opacity:0}100%{opacity:1}}
@keyframes max{0%,20%,100%{opacity:.6}40%,85%{opacity:1}}
@keyframes spark{0%,25%{transform:scale(0);opacity:0}40%{transform:scale(1.2);opacity:1}70%{transform:scale(.8);opacity:.8}85%,100%{transform:scale(0);opacity:0}}` +
    rm(".eyes{opacity:0}"),
  alerta:
    `.squash{animation:shake 2.4s ease both}.alert{animation:coral 2.4s ease both}
@keyframes shake{0%,8%,52%,100%{transform:none}14%{transform:translateX(-5px) rotate(-3deg)}22%{transform:translateX(5px) rotate(3deg)}30%{transform:translateX(-4px) rotate(-2deg)}38%{transform:translateX(3px) rotate(1deg)}46%{transform:translateX(-1px)}}
@keyframes coral{0%,6%{opacity:0}16%,100%{opacity:1}}` + rm(),
  cargando:
    `.eyes{animation:look 1.6s ease-in-out infinite}.scan{animation:scan 1.6s linear infinite}.dol-glow{animation:br 1.6s ease-in-out infinite}.bob{animation:bob 1.6s ease-in-out infinite}
@keyframes look{0%,100%{transform:translateX(-7px)}50%{transform:translateX(7px)}}
@keyframes scan{0%{transform:translateX(-56px);opacity:0}15%,85%{opacity:1}100%{transform:translateX(56px);opacity:0}}
@keyframes br{0%,100%{opacity:.35}50%{opacity:1}}@keyframes bob{50%{transform:translateY(-3px)}}` + rm(".scan{opacity:0}"),
  errorcarga:
    `.squash{animation:tilt 3s ease-in-out infinite}.eyeL{animation:odd 3s ease-in-out infinite}.q{animation:q 3s ease-in-out infinite}
@keyframes tilt{0%,100%{transform:rotate(0)}25%,75%{transform:rotate(-7deg)}}
@keyframes odd{0%,15%,90%,100%{transform:scaleY(1)}28%,78%{transform:scaleY(.45)}}
@keyframes q{0%,15%{opacity:0;transform:translateY(6px)}30%,80%{opacity:1;transform:translateY(0)}65%{transform:translateY(-3px)}95%,100%{opacity:0}}` + rm(),
  sinconexion:
    `.wifi{animation:wf 3.2s steps(1) infinite}.slash{animation:sl 3.2s ${E} infinite}.eyes{animation:dimE 3.2s ease infinite}.dol-glow{animation:dimG 3.2s ease infinite}.bob{animation:sink 3.2s ease-in-out infinite}
@keyframes wf{0%,100%{opacity:1}10%{opacity:.3}14%{opacity:1}20%{opacity:.25}24%,92%{opacity:.55}}
@keyframes sl{0%,22%{transform:scaleX(0);opacity:0}32%,88%{transform:scaleX(1);opacity:1}100%{opacity:0}}
@keyframes dimE{0%,25%,100%{opacity:1}40%,85%{opacity:.4}}@keyframes dimG{0%,25%,100%{opacity:.6}40%,85%{opacity:.1}}
@keyframes sink{0%,25%,100%{transform:translateY(0)}45%,85%{transform:translateY(5px)}}` + rm(),
  errorguardar:
    `.cbounce{animation:cb 2.6s ${E} both}.squash{animation:hit 2.6s ease both}.alert{animation:coral 2.6s ease both}
@keyframes cb{0%{transform:translateY(-20px);opacity:0}10%{opacity:1}30%{transform:translateY(30px)}45%{transform:translateY(-14px) rotate(25deg)}60%{transform:translateY(8px) rotate(50deg)}75%,100%{transform:translateY(-30px) rotate(80deg);opacity:0}}
@keyframes hit{0%,28%,62%,100%{transform:none}33%{transform:scale(1.04,.94)}40%{transform:translateX(-4px) rotate(-2deg)}48%{transform:translateX(4px) rotate(2deg)}55%{transform:translateX(-2px)}}
@keyframes coral{0%,28%{opacity:0}36%,100%{opacity:1}}` + rm(".cbounce{opacity:0}"),
  sesion:
    `.bob{animation:br 3.6s ease-in-out infinite}.z{animation:z 3.6s ease-out infinite}.z2{animation-delay:1.2s}.z3{animation-delay:2.4s}.lock{animation:lk 1.8s ease-in-out infinite}
@keyframes br{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(2px) scale(1.02,.98)}}
@keyframes z{0%{transform:translate(0,6px) scale(.6);opacity:0}20%{opacity:1}100%{transform:translate(10px,-22px) scale(1.1);opacity:0}}
@keyframes lk{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}` + rm(),
};

const src = (pose: BolsiPose) => `/bolsi/bolsi-${pose}.svg`;
const cache = new Map<string, Promise<string>>();
const load = (pose: BolsiPose) => {
  const url = src(pose);
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => t.replace(/<metadata>[\s\S]*?<\/metadata>/, ""));
    // Si falla (p. ej. sin conexión), se reintenta la próxima vez.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
};

/** Baja las poses de antemano (así se animan aunque después se corte la conexión). */
export const preloadBolsi = (poses: BolsiPose[]) => poses.forEach((p) => void load(p).catch(() => {}));

export function Bolsi({ pose, width, height, className, style }: { pose: BolsiPose; width?: number; height?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let alive = true;
    load(pose)
      .then((svg) => {
        if (!alive) return;
        // El shadow root (sin slot) reemplaza a la imagen quieta que está adentro.
        const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
        const st = document.createElement("style");
        st.textContent = `${BASE}\n${POSE[pose]}`;
        const box = document.createElement("div");
        box.style.cssText = "width:100%;height:100%";
        box.innerHTML = svg;
        const el = box.querySelector("svg");
        if (el) {
          el.removeAttribute("width");
          el.removeAttribute("height");
          el.setAttribute("aria-hidden", "true");
        }
        root.replaceChildren(st, box);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pose]);

  return (
    <span
      ref={ref}
      data-bolsi={pose}
      aria-hidden
      className={className}
      style={{ display: "inline-block", lineHeight: 0, flex: "none", aspectRatio: "200 / 220", ...(width && { width }), ...(height && { height }), ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src(pose)} alt="" style={{ width: "100%", height: "100%" }} />
    </span>
  );
}
