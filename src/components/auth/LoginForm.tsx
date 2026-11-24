"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiClientError, post, setAccessToken } from "@/lib/api-client";
import { MSG } from "@/lib/auth/validate";
import type { UserDto } from "@/lib/auth/session";
import { Field, FormError, Icon, Logo, authStyles as s } from "./parts";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOk, setResetOk] = useState(false);

  useEffect(() => {
    // ?ok=1 llega después de guardar una contraseña nueva.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResetOk(new URLSearchParams(window.location.search).get("ok") === "1");
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setErr(MSG.loginEmail);
    if (!pass) return setErr(MSG.loginPass);
    setBusy(true);
    setErr("");
    try {
      const res = await post<{ user: UserDto; access_token: string }>("/auth/login", { email, password: pass });
      setAccessToken(res.access_token);
      router.replace("/");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "No pudimos conectarnos. Revisá tu conexión.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={s.form} noValidate>
      <Logo slogan />
      <h1 className={s.title}>Iniciá sesión</h1>
      <p className={s.lead}>Tus gastos, ingresos y pagos del mes en un solo lugar.</p>
      {resetOk && (
        <div className={s.ok}>
          <Icon name="check_circle" />
          Contraseña actualizada. Entrá con la nueva.
        </div>
      )}
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
        aside={
          <Link href="/recuperar" className={s.link}>
            ¿Te la olvidaste?
          </Link>
        }
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <FormError>{err}</FormError>
      <button type="submit" className={s.primary} disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
      <div className={s.switch}>
        ¿No tenés cuenta?
        <Link href="/registro" className={s.link}>
          Creá una
        </Link>
      </div>
    </form>
  );
}
