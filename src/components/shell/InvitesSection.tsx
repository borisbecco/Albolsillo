"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import { useShell } from "./ShellContext";
import p from "./profile.module.css";

type Invite = { id: string; email: string; code: string; status: "pending" | "joined" | "cancelled" | "expired"; link: string; created_at: string };
type List = { invites: Invite[]; remaining: number; quota: number };

const STATUS: Record<Invite["status"], [string, string]> = {
  pending: ["Pendiente", "var(--amb)"],
  joined: ["Se unió", "var(--pos)"],
  cancelled: ["Anulada", "var(--dim)"],
  expired: ["Vencida", "var(--dim)"],
};
const MN = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MN[Number(iso.slice(5, 7)) - 1]}`;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Perfil › Invitaciones: 5 por usuario, cada código sirve una vez y vence a los 14 días. */
export function InvitesSection() {
  const { flash } = useShell();
  const [data, setData] = useState<List | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<List>("/invites")
      .then(setData)
      .catch(() => {});
  }, []);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return setErr("Revisá el email");
    setBusy(true);
    setErr("");
    try {
      const r = await api<List & { code: string; link: string }>("/invites", { method: "POST", body: JSON.stringify({ email: em }) });
      setData({ invites: r.invites, remaining: r.remaining, quota: r.quota });
      setEmail("");
      const copied = await copy(r.link);
      flash(copied ? "Le mandamos un mail y copiamos el link para que se lo pases" : `Le mandamos un mail. Código: ${r.code}`, "ingreso");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "No pudimos mandar la invitación.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await api(`/invites/${id}`, { method: "DELETE" });
      setData((d) => d && { ...d, invites: d.invites.map((i) => (i.id === id ? { ...i, status: "cancelled" } : i)) });
      flash("Invitación anulada");
    } catch (e) {
      flash(e instanceof ApiClientError ? e.message : "No pudimos anularla.", "errorguardar");
    }
  };

  const left = data?.remaining ?? 0;
  return (
    <section className={p.section}>
      <div className={p.invHead}>
        <span className={p.sectionTitle}>Invitaciones</span>
        {data && <span className={p.invLeft}>{left === 1 ? "Te queda 1" : `Te quedan ${left}`}</span>}
      </div>
      <span className={p.invNote}>Albolsillo es solo por invitación. Cada link sirve para una persona y vence a los 14 días.</span>
      <form className={p.invForm} onSubmit={send} noValidate>
        <input
          className={p.input}
          type="email"
          value={email}
          onChange={(e) => {
            setErr("");
            setEmail(e.target.value);
          }}
          placeholder="Email de quien invitás"
          aria-label="Email de quien invitás"
          disabled={!left}
        />
        <button type="submit" className={p.invSend} disabled={busy || !left}>
          <span className="material-symbols-rounded">send</span>
          {busy ? "Enviando…" : "Invitar"}
        </button>
      </form>
      {err && <span className={p.err}>{err}</span>}
      {!!data?.invites.length && (
        <div className={p.invList}>
          {data.invites.map((i) => {
            const [label, color] = STATUS[i.status];
            return (
              <div key={i.id} className={p.invRow}>
                <span className={p.invAvatar}>{i.email[0]?.toUpperCase()}</span>
                <span className={p.invText}>
                  <span>{i.email}</span>
                  <small>
                    {i.code} · {shortDate(i.created_at)}
                  </small>
                </span>
                <span className={p.invStatus} style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}>
                  {label}
                </span>
                {i.status === "pending" && (
                  <>
                    <button
                      className={`${p.invIcon} material-symbols-rounded`}
                      title="Copiar link"
                      onClick={async () => flash((await copy(i.link)) ? "Link copiado" : i.link)}
                    >
                      link
                    </button>
                    <button className={`${p.invIcon} ${p.invCancel} material-symbols-rounded`} title="Anular" onClick={() => cancel(i.id)}>
                      close
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
