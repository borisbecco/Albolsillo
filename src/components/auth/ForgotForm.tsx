"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ApiClientError, post } from "@/lib/api-client";
import { MSG, isValidEmail } from "@/lib/auth/validate";
import { Field, FormError, Icon, authStyles as s } from "./parts";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  async function send() {
    setBusy(true);
    setErr("");
    try {
      await post("/auth/password/forgot", { email });
      return true;
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "No pudimos conectarnos. Revisá tu conexión.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) return setErr(MSG.forgotEmail);
    if (await send()) setSent(true);
  }

  if (sent) {
    return (
      <div className={s.form}>
        <Icon name="mark_email_read" className={s.mailIcon} />
        <h1 className={s.title}>Revisá tu mail</h1>
        <p className={s.lead}>
          Mandamos un link a <strong>{email.trim()}</strong>. Vence en 30 minutos. Si no lo ves, buscá en spam.
        </p>
        <FormError>{err}</FormError>
        <div className={s.row}>
          <button
            type="button"
            className={s.link}
            disabled={busy}
            onClick={async () => setResent(await send())}
          >
            {resent ? "Mail reenviado" : "Reenviar mail"}
          </button>
          <Link href="/entrar" className={s.muted}>
            Volver a entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={s.form} noValidate>
      <Link href="/entrar" className={s.back}>
        <Icon name="arrow_back" />
        Volver
      </Link>
      <h1 className={s.title}>Recuperá tu contraseña</h1>
      <p className={s.lead}>Te mandamos un link para crear una nueva.</p>
      <Field
        label="Email de tu cuenta"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vos@email.com"
        autoComplete="email"
      />
      <FormError>{err}</FormError>
      <button type="submit" className={s.primary} disabled={busy}>
        {busy ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}
