"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, api, logout, setAccessToken } from "@/lib/api-client";
import { MIN_PASSWORD, PASSWORD_LABELS, passwordLevel } from "@/lib/auth/validate";
import { maskAmountInput, parseAmount, toDecimal, toInput } from "@/lib/money";
import type { UserDto } from "@/lib/auth/session";
import { initials, useShell } from "./ShellContext";
import p from "./profile.module.css";

const RATES: [UserDto["rate_type"], string][] = [
  ["oficial", "Oficial"],
  ["blue", "Blue"],
  ["bolsa", "MEP"],
  ["tarjeta", "Tarjeta"],
  ["manual", "Manual"],
];
const STRATS: [UserDto["pay_strategy"], string][] = [
  ["intereses", "Evitar intereses"],
  ["avalancha", "Avalancha"],
  ["bola", "Bola de nieve"],
];
const LEVEL_COLORS = ["var(--line2)", "var(--red)", "var(--amb)", "var(--pos)", "var(--pos)"];

/** Panel de Perfil y configuración. */
export function ProfilePanel() {
  const router = useRouter();
  const { user, profileOpen, setProfileOpen, updatePrefs, flash } = useShell();
  const [name, setName] = useState(user.name);
  const [manual, setManual] = useState(user.manual_rate ? toInput(user.manual_rate) : "");
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCur, setPwCur] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!profileOpen) return null;

  const saveName = () => {
    const n = name.trim();
    if (n && n !== user.name) updatePrefs({ name: n });
    else setName(user.name);
  };

  const saveManual = () => {
    const v = parseAmount(manual);
    if (v && String(v) !== user.manual_rate) updatePrefs({ rate_type: "manual", manual_rate: toDecimal(v) });
  };

  const savePw = async () => {
    if (!pwCur) return setPwErr("Ingresá tu contraseña actual");
    if (pwNew.length < MIN_PASSWORD) return setPwErr("La nueva necesita al menos 8 caracteres");
    if (pwNew !== pwNew2) return setPwErr("Las contraseñas no coinciden");
    setBusy(true);
    try {
      await api("/me/password", { method: "POST", body: JSON.stringify({ current: pwCur, new: pwNew }) });
      setPwOpen(false);
      setPwCur("");
      setPwNew("");
      setPwNew2("");
      setPwErr("");
      flash("Contraseña actualizada");
    } catch (e) {
      setPwErr(e instanceof ApiClientError ? e.message : "No pudimos cambiarla. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!delConfirm) return setDelConfirm(true);
    setBusy(true);
    try {
      await api("/me", { method: "DELETE", body: JSON.stringify({ confirm: true }) });
      setAccessToken(null);
      router.replace("/registro");
    } catch (e) {
      flash(e instanceof ApiClientError ? e.message : "No pudimos eliminar la cuenta. Probá de nuevo.", "errorguardar");
      setBusy(false);
    }
  };

  const level = passwordLevel(pwNew);

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
          <button className={p.rowBtn} onClick={() => setPwOpen((o) => !o)} aria-expanded={pwOpen}>
            <span className="material-symbols-rounded">lock</span>
            <span>Cambiar contraseña</span>
            <span className="material-symbols-rounded">{pwOpen ? "expand_less" : "expand_more"}</span>
          </button>
          {pwOpen && (
            <div className={p.pwBox}>
              <input className={p.input} type="password" value={pwCur} onChange={(e) => setPwCur(e.target.value)} placeholder="Contraseña actual" autoComplete="current-password" />
              <input className={p.input} type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Nueva (mínimo 8 caracteres)" autoComplete="new-password" />
              <div className={p.meter}>
                <div>
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ background: i <= level ? LEVEL_COLORS[level] : undefined }} />
                  ))}
                </div>
                <small style={{ color: LEVEL_COLORS[level] }}>{PASSWORD_LABELS[level]}</small>
              </div>
              <input className={p.input} type="password" value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} placeholder="Repetila" autoComplete="new-password" />
              {pwErr && <span className={p.err}>{pwErr}</span>}
              <button className={p.primary} onClick={savePw} disabled={busy}>
                {busy ? "Guardando…" : "Actualizar contraseña"}
              </button>
            </div>
          )}
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
          <label className={p.row}>
            <span>Cotización del dólar</span>
            <select className={p.select} value={user.rate_type} onChange={(e) => updatePrefs({ rate_type: e.target.value as UserDto["rate_type"] })}>
              {RATES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {user.rate_type === "manual" && (
            <label className={p.row}>
              <span>Valor manual ($ por US$)</span>
              <input
                className={p.input}
                style={{ width: 120, textAlign: "right" }}
                value={manual}
                onChange={(e) => setManual(maskAmountInput(e.target.value))}
                onBlur={saveManual}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                inputMode="decimal"
                placeholder="1.500"
              />
            </label>
          )}
          <label className={p.row}>
            <span>Estrategia de pago</span>
            <select className={p.select} value={user.pay_strategy} onChange={(e) => updatePrefs({ pay_strategy: e.target.value as UserDto["pay_strategy"] })}>
              {STRATS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
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

        <div className={p.danger}>
          <button className={p.deleteBtn} data-confirm={delConfirm} onClick={deleteAccount} onBlur={() => setDelConfirm(false)} disabled={busy}>
            {delConfirm ? "Sí, eliminar mi cuenta" : "Eliminar cuenta"}
          </button>
          <span>{delConfirm ? "Se borran todos tus movimientos, tarjetas y metas. No se puede deshacer." : "Borra tu cuenta y todos tus datos."}</span>
        </div>
      </div>
    </div>
  );
}
