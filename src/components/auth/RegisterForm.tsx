"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiClientError, post, setAccessToken } from "@/lib/api-client";
import { MIN_PASSWORD, MSG, isValidEmail } from "@/lib/auth/validate";
import type { UserDto } from "@/lib/auth/session";
import { Field, FormError, Logo, PasswordMeter, authStyles as s } from "./parts";
import { LegalSheet, type LegalTab } from "@/components/legal/LegalSheet";

const INVITE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
/** "abcd1234" → "ABCD-1234" mientras se tipea. */
const maskCode = (v: string) => {
  const c = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [terms, setTerms] = useState(false);
  const [code, setCode] = useState("");
  const [codeInfo, setCodeInfo] = useState<{ code: string; valid: boolean; inviter: string | null } | null>(null);
  const [legal, setLegal] = useState<LegalTab | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Desde el link de invitación llegan ?invite=CÓDIGO y ?email=...
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const e = q.get("email");
    const c = q.get("invite");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e) setEmail(e);
    if (c) setCode(maskCode(c));
  }, []);

  // Con el código completo, se valida (y se muestra quién invitó).
  useEffect(() => {
    if (!INVITE_RE.test(code)) return;
    let cancel = false;
    fetch(`/api/v1/invites/${code}`)
      .then((r) => r.json())
      .then((r: { valid: boolean; inviter_name: string | null; email?: string }) => {
        if (cancel) return;
        setCodeInfo({ code, valid: r.valid, inviter: r.inviter_name });
        if (r.valid && r.email) setEmail((cur) => cur || r.email!);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [code]);
  const info = codeInfo?.code === code ? codeInfo : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!INVITE_RE.test(code)) return setErr("Poné el código de invitación (XXXX-XXXX).");
    if (info && !info.valid) return setErr("Ese código no sirve: venció, ya se usó o está mal escrito.");
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
        invite_code: code,
      });
      setAccessToken(res.access_token);
      router.replace("/bienvenida");
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
      <label className={s.inviteField}>
        Código de invitación
        <span className={s.inviteBox}>
          <input
            value={code}
            onChange={(e) => {
              setErr("");
              setCode(maskCode(e.target.value));
            }}
            placeholder="XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={info ? !info.valid : undefined}
          />
          {info?.valid && <span className={`material-symbols-rounded ${s.inviteOk}`}>check_circle</span>}
        </span>
        <span className={s.inviteHint} style={info && !info.valid ? { color: "var(--red)" } : undefined}>
          {info?.valid
            ? info.inviter
              ? `Te invitó ${info.inviter}.`
              : "Código válido."
            : info
              ? "Ese código no sirve: venció, ya se usó o está mal escrito."
              : "Albolsillo es por invitación. El código viene en el link que te mandaron."}
        </span>
      </label>
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
        <span>
          Acepto los{" "}
          <button type="button" className={s.inlineLink} onClick={() => setLegal("terms")}>
            términos
          </button>{" "}
          y la{" "}
          <button type="button" className={s.inlineLink} onClick={() => setLegal("privacy")}>
            política de privacidad
          </button>
          .
        </span>
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
      {legal && <LegalSheet tab={legal} onTab={setLegal} onClose={() => setLegal(null)} />}
    </form>
  );
}
