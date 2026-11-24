"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { PASSWORD_LABELS, passwordLevel } from "@/lib/auth/validate";
import s from "./auth.module.css";

export { s as authStyles };

/** Logo según el tema (las dos versiones están en el DOM; CSS muestra la que corresponde). */
export function Logo({ slogan = false }: { slogan?: boolean }) {
  const base = slogan ? "logo-slogan-horizontal" : "logo-horizontal";
  const alt = slogan ? "Albolsillo. Directo Albolsillo." : "Albolsillo";
  const cls = slogan ? s.logoSlogan : s.logo;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${base}-oscuro.svg`} alt={alt} className={`${cls} only-dark`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${base}-claro.svg`} alt={alt} className={`${cls} only-light`} />
    </>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; aside?: ReactNode };

export function Field({ label, aside, ...input }: FieldProps) {
  return (
    <label className={s.field}>
      {aside ? (
        <span className={s.fieldHead}>
          {label}
          {aside}
        </span>
      ) : (
        label
      )}
      <input className={s.input} {...input} />
    </label>
  );
}

const LEVEL_COLORS = ["var(--line2)", "var(--red)", "var(--amb)", "var(--pos)", "var(--pos)"];

export function PasswordMeter({ value }: { value: string }) {
  const level = passwordLevel(value);
  const color = LEVEL_COLORS[level];
  return (
    <div className={s.meter} aria-live="polite">
      <div className={s.bars}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={s.bar} style={i <= level ? { background: color } : undefined} />
        ))}
      </div>
      <span className={s.meterLabel} style={{ color }}>
        {PASSWORD_LABELS[level]}
      </span>
    </div>
  );
}

export function FormError({ children }: { children?: string }) {
  return children ? (
    <div className={s.error} role="alert">
      {children}
    </div>
  ) : null;
}

export const Icon = ({ name, className }: { name: string; className?: string }) => (
  <span className={`material-symbols-rounded ${className ?? s.icon}`} aria-hidden>
    {name}
  </span>
);
