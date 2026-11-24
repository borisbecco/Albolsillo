"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/api-client";
import { initials, useShell } from "./ShellContext";
import p from "./profile.module.css";

// Primera versión del panel de Perfil: cuenta, tema, moneda y cierre de sesión.
// Falta: cambiar contraseña, cotización del dólar, estrategia, rehacer onboarding y eliminar cuenta.
export function ProfilePanel() {
  const router = useRouter();
  const { user, profileOpen, setProfileOpen, updatePrefs } = useShell();
  const [name, setName] = useState(user.name);
  const [leaving, setLeaving] = useState(false);

  if (!profileOpen) return null;

  const saveName = () => {
    const n = name.trim();
    if (n && n !== user.name) updatePrefs({ name: n });
    else setName(user.name);
  };

  return (
    <div className={p.backdrop} onClick={() => setProfileOpen(false)}>
      <div className={p.panel} role="dialog" aria-modal="true" aria-label="Perfil y configuración" onClick={(e) => e.stopPropagation()}>
        <div className={p.head}>
          <span className={p.headTitle}>Perfil y configuración</span>
          <button className={`${p.close} material-symbols-rounded`} title="Cerrar (Esc)" onClick={() => setProfileOpen(false)}>
            close
          </button>
        </div>

        <div className={p.who}>
          <span className={p.bigAvatar}>{initials(user)}</span>
          <div className={p.whoText}>
            <span className={p.whoName}>{user.name}</span>
            <span className={p.whoEmail}>{user.email}</span>
          </div>
        </div>

        <section className={p.section}>
          <span className={p.sectionTitle}>Cuenta</span>
          <label className={p.field}>
            Nombre
            <input
              className={p.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="Cómo te llamás"
            />
          </label>
          <label className={p.field}>
            Email
            <input className={p.input} value={user.email} readOnly />
          </label>
        </section>

        <section className={p.section}>
          <span className={p.sectionTitle}>Preferencias</span>
          <div className={p.row}>
            <span>Tema</span>
            <div className={p.seg} role="group" aria-label="Tema">
              {(
                [
                  ["dark", "Oscuro"],
                  ["light", "Claro"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} aria-pressed={user.theme === v} onClick={() => updatePrefs({ theme: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className={p.row}>
            <span>Mostrar montos en</span>
            <div className={p.seg} role="group" aria-label="Mostrar montos en">
              {(["ARS", "USD"] as const).map((c) => (
                <button key={c} aria-pressed={user.display_currency === c} onClick={() => updatePrefs({ display_currency: c })}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button
          className={p.linkRow}
          onClick={() => {
            setProfileOpen(false);
            router.push("/bienvenida");
          }}
        >
          <span className="material-symbols-rounded">tune</span>
          <span className={p.linkText}>
            Ingresos, tarjetas y gastos fijos
            <small>Rehacé el onboarding cuando quieras</small>
          </span>
          <span className="material-symbols-rounded">chevron_right</span>
        </button>

        <button
          className={p.logout}
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await logout().catch(() => {});
            router.replace("/entrar");
          }}
        >
          <span className="material-symbols-rounded">logout</span>
          {leaving ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}
