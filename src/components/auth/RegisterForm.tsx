"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiClientError, post, setAccessToken } from "@/lib/api-client";
import { MIN_PASSWORD, MSG, isValidEmail } from "@/lib/auth/validate";
import type { UserDto } from "@/lib/auth/session";
import { Field, FormError, Logo, PasswordMeter, authStyles as s } from "./parts";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr(MSG.regName);
    if (!isValidEmail(email)) return setErr(MSG.regEmail);
    if (pass.length < MIN_PASSWORD) return setErr(MSG.regPass);
    if (!terms) return setErr(MSG.regTerms);
    setBusy(true);
    setErr("");
    try {
      const res = await post<{ user: UserDto; access_token: string }>("/auth/register", {
        name,
        email,
        password: pass,
        accept_terms: true,
      });
      setAccessToken(res.access_token);
      router.replace("/");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "No pudimos conectarnos. Revisá tu conexión.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={s.form} noValidate>
      <Logo />
      <h1 className={s.title}>Creá tu cuenta</h1>
      <p className={s.lead}>Después te pedimos tus ingresos y tarjetas para armar el plan del mes.</p>
      <Field
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Cómo te llamás"
        autoComplete="given-name"
      />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vos@email.com"
        autoComplete="email"
      />
      <Field
        label="Contraseña"
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
      />
      <PasswordMeter value={pass} />
      <label className={s.check}>
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>Acepto los términos y la política de privacidad.</span>
      </label>
      <FormError>{err}</FormError>
      <button type="submit" className={s.primary} disabled={busy}>
        {busy ? "Creando…" : "Crear cuenta"}
      </button>
      <div className={s.switch}>
        ¿Ya tenés cuenta?
        <Link href="/entrar" className={s.link}>
          Entrá
        </Link>
      </div>
    </form>
  );
}
