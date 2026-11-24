"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiClientError, post } from "@/lib/api-client";
import { MIN_PASSWORD, MSG } from "@/lib/auth/validate";
import { Field, FormError, Logo, PasswordMeter, authStyles as s } from "./parts";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [deadLink, setDeadLink] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pass.length < MIN_PASSWORD) return setErr(MSG.resetPass);
    if (pass !== pass2) return setErr(MSG.resetMatch);
    setBusy(true);
    setErr("");
    try {
      await post("/auth/password/reset", { token, password: pass });
      router.replace("/entrar?ok=1");
    } catch (e) {
      if (e instanceof ApiClientError) {
        setErr(e.message);
        setDeadLink(e.code === "token_invalid" || e.code === "token_expired");
      } else {
        setErr("No pudimos conectarnos. Revisá tu conexión.");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={s.form} noValidate>
      <Logo />
      <h1 className={s.title}>Elegí una contraseña nueva</h1>
      <Field
        label="Contraseña nueva"
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
      />
      <PasswordMeter value={pass} />
      <Field
        label="Repetila"
        type="password"
        value={pass2}
        onChange={(e) => setPass2(e.target.value)}
        placeholder="••••••••"
        autoComplete="new-password"
      />
      <FormError>{err}</FormError>
      {deadLink ? (
        <Link href="/recuperar" className={s.primary} style={{ display: "grid", placeItems: "center" }}>
          Pedir un link nuevo
        </Link>
      ) : (
        <button type="submit" className={s.primary} disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      )}
    </form>
  );
}
