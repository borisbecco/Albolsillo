"use client";

import { useState, type FormEvent } from "react";
import { isValidEmail } from "@/lib/auth/validate";
import { pickableCategories } from "@/lib/categories";
import { formatMoney, maskAmountEvent, parseAmount, toDecimal } from "@/lib/money";
import { MONTH_SHORT } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import { balances } from "@/lib/shared";
import type { PersonDto } from "@/lib/dto";
import { useData } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { todayAR } from "@/components/tx/parts";
import s from "./shared.module.css";

/** Color estable por persona (a partir del id). */
const hueOf = (id: string) => [250, 160, 40, 300, 200, 350, 100][[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 7];
const tint = (h: number) => `oklch(0.76 0.15 ${h} / .16)`;
const col = (h: number) => `oklch(0.76 0.15 ${h})`;

const TAG: Record<PersonDto["status"], { label: string; bg: string; fg: string }> = {
  user: { label: "En Albolsillo", bg: "color-mix(in oklch, var(--acc) 18%, transparent)", fg: "var(--acc2)" },
  invited: { label: "Invitación enviada", bg: "color-mix(in oklch, var(--amb) 16%, transparent)", fg: "var(--amb)" },
  contact: { label: "Contacto", bg: "var(--sel)", fg: "var(--mut)" },
};

/** Aviso tras invitar: si no salió el mail (sin mails configurados), se copia el link para pasarlo por WhatsApp. */
async function inviteNotice(name: string, r: { mailSent: boolean | null; link: string | null }, sent: string) {
  if (r.mailSent || !r.link) return sent;
  const copied = await navigator.clipboard?.writeText(r.link).then(() => true).catch(() => false);
  return copied ? `Copiamos el link de ${name}: pasáselo por WhatsApp (no se mandó mail)` : `Pasale este link a ${name}: ${r.link}`;
}

export function SharedView() {
  const { forced, flash } = useShell();
  const { people, shared, rate, settle, invitePerson } = useData();
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  if (!people.length && !shared.length && !forced.shared) return <EmptyState copy={EMPTY.shared!} />;

  const toArs = (n: number, c: "ARS" | "USD") => (c === "USD" ? (rate ? n * rate : 0) : n);
  const bal = balances(shared, toArs);
  const owedToMe = Object.values(bal).filter((v) => v >= 1).reduce((t, v) => t + v, 0);
  const iOwe = -Object.values(bal).filter((v) => v <= -1).reduce((t, v) => t + v, 0);
  const count = (f: (v: number) => boolean) => Object.values(bal).filter(f).length;
  const nameOf = (id: string) => (id === "me" ? "Vos" : (people.find((p) => p.id === id)?.name ?? "Alguien"));
  const plural = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;

  return (
    <div className={s.wrap}>
      <div className={s.kpis}>
        <div className={s.kpi}>
          <span>Te deben</span>
          <strong style={{ color: "var(--pos)" }}>{formatMoney(owedToMe, "ARS")}</strong>
          <small>{plural(count((v) => v >= 1))}</small>
        </div>
        <div className={s.kpi}>
          <span>Debés</span>
          <strong style={{ color: iOwe > 0 ? "var(--amb)" : "var(--fg)" }}>{formatMoney(iOwe, "ARS")}</strong>
          <small>{plural(count((v) => v <= -1))}</small>
        </div>
        <div className={s.kpi}>
          <span>Balance</span>
          <strong>{formatMoney(owedToMe - iOwe, "ARS")}</strong>
          <small>{owedToMe >= iOwe ? "A tu favor" : "En contra"}</small>
        </div>
      </div>

      <div className={s.cols}>
        <section className={s.panel}>
          <div className={s.panelHead}>
            <strong>Contactos</strong>
            <span>Los que usan Albolsillo ven los mismos gastos y saldos que vos.</span>
          </div>
          {people.map((p) => {
            const b = bal[p.id] ?? 0;
            const even = Math.abs(b) < 1;
            const h = hueOf(p.id);
            const tag = TAG[p.status];
            return (
              <div key={p.id}>
                <div className={s.person}>
                  <span className={s.avatar} style={{ background: tint(h), color: col(h) }}>
                    {p.name[0]?.toUpperCase()}
                  </span>
                  <div className={s.personMain}>
                    <span className={s.personName}>
                      <strong>{p.name}</strong>
                      <em style={{ background: tag.bg, color: tag.fg }}>{tag.label}</em>
                    </span>
                    <span style={{ color: even ? "var(--mut)" : b > 0 ? "var(--pos)" : "var(--amb)", fontSize: 12 }}>
                      {even ? "Están a mano" : b > 0 ? `Te debe ${formatMoney(b, "ARS")}` : `Le debés ${formatMoney(-b, "ARS")}`}
                    </span>
                    {p.status !== "user" && (
                      <button
                        className={s.linkBtn}
                        onClick={async () => {
                          if (p.status === "invited" && p.email) {
                            const r = await invitePerson(p.id);
                            if (r) flash(await inviteNotice(p.name, r, `Reenviamos la invitación a ${p.email}`));
                          } else {
                            setInviteFor(inviteFor === p.id ? null : p.id);
                            setInviteEmail(p.email ?? "");
                          }
                        }}
                      >
                        {p.status === "invited" ? "Reenviar invitación" : "Invitar a Albolsillo"}
                      </button>
                    )}
                  </div>
                  {!even && (
                    <button
                      className={s.pillBtn}
                      onClick={async () => {
                        // > 0: la persona le pagó al usuario; < 0: el usuario le pagó.
                        if (await settle(p.id, `${b > 0 ? "" : "-"}${toDecimal(Math.abs(b))}`))
                          flash(b > 0 ? `${p.name} te pagó. Quedaron a mano` : `Le pagaste a ${p.name}. Quedaron a mano`);
                      }}
                    >
                      {b > 0 ? "Me pagó" : "Le pagué"}
                    </button>
                  )}
                </div>
                {inviteFor === p.id && (
                  <form
                    className={s.inviteRow}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!isValidEmail(inviteEmail)) return flash("Revisá el email");
                      const r = await invitePerson(p.id, inviteEmail.trim());
                      if (r) {
                        setInviteFor(null);
                        flash(await inviteNotice(p.name, r, `Le mandamos una invitación a ${p.name}`));
                      }
                    }}
                  >
                    <input className={s.input} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={`Email de ${p.name}`} autoFocus />
                    <button className={s.primary} type="submit">
                      Invitar
                    </button>
                  </form>
                )}
              </div>
            );
          })}
          <AddPerson />
        </section>

        <NewShared nameOf={nameOf} />
      </div>

      {shared.length > 0 && (
        <section className={s.history}>
          <strong className={s.historyTitle}>Historial</strong>
          {shared.map((e) => {
            const dt = `${Number(e.date.slice(8))} ${MONTH_SHORT[Number(e.date.slice(5, 7)) - 1]}`;
            const settlement = e.kind === "settlement";
            const h = settlement ? 150 : hueOf(e.paid_by === "me" ? (e.participants.find((x) => x !== "me") ?? "me") : e.paid_by);
            const me = e.participants.includes("me");
            return (
              <HistoryRow
                key={e.id}
                id={e.id}
                icon={settlement ? "handshake" : "group"}
                hue={h}
                title={e.description}
                sub={settlement ? dt : `Pagó ${nameOf(e.paid_by)} · entre ${e.participants.length} · ${dt}`}
                amount={formatMoney(Number(e.total), e.currency)}
                mine={settlement ? "Saldado" : me ? `Tu parte ${formatMoney(Number(e.total) / e.participants.length, e.currency)}` : "No participás"}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}

function HistoryRow({ id, icon, hue, title, sub, amount, mine }: { id: string; icon: string; hue: number; title: string; sub: string; amount: string; mine: string }) {
  const { flash } = useShell();
  const { deleteShared } = useData();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={s.row}>
      <span className={`${s.rowIcon} material-symbols-rounded`} style={{ background: tint(hue), color: col(hue) }}>
        {icon}
      </span>
      <div className={s.rowMain}>
        <span>{title}</span>
        <small>{sub}</small>
      </div>
      <div className={s.rowAmount}>
        <strong>{amount}</strong>
        <small>{mine}</small>
      </div>
      <button
        className={`${s.rowDel} material-symbols-rounded`}
        data-confirm={confirm}
        title={confirm ? "Tocá de nuevo para eliminar" : "Eliminar"}
        onBlur={() => setConfirm(false)}
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          if (await deleteShared(id)) flash("Eliminado");
        }}
      >
        {confirm ? "delete_forever" : "delete"}
      </button>
    </div>
  );
}

function AddPerson() {
  const { flash } = useShell();
  const { addPerson } = useData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return flash("Poné un nombre");
    if (email.trim() && !isValidEmail(email)) return flash("Revisá el email");
    setBusy(true);
    const r = await addPerson(name.trim(), email.trim() || null);
    setBusy(false);
    if (r) {
      const p = r.person;
      flash(email.trim() ? await inviteNotice(p.name, r, `Agregamos a ${p.name} y le mandamos una invitación`) : `Agregamos a ${p.name} a tus contactos`);
      setName("");
      setEmail("");
    }
  };

  return (
    <form className={s.addPerson} onSubmit={submit} noValidate>
      <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" aria-label="Nombre del contacto" maxLength={60} />
      <input className={s.input} style={{ flex: "2 1 180px" }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email para invitar (opcional)" aria-label="Email del contacto" />
      <button className={s.primary} type="submit" disabled={busy} title="Agregar">
        <span className="material-symbols-rounded">person_add</span>
        Agregar
      </button>
    </form>
  );
}

function NewShared({ nameOf }: { nameOf: (id: string) => string }) {
  const { flash, isPastMonth } = useShell();
  const { people, addShared } = useData();
  const [desc, setDesc] = useState("");
  const [total, setTotal] = useState("");
  const [paidBy, setPaidBy] = useState("me");
  const [cat, setCat] = useState("resto");
  const [among, setAmong] = useState<string[]>(["me"]);
  const [busy, setBusy] = useState(false);
  const ids = ["me", ...people.map((p) => p.id)];
  const t = parseAmount(total);

  const submit = async () => {
    if (isPastMonth) return flash("En un mes pasado no se puede cargar nada.");
    if (!desc.trim() || !t || among.length < 2) return flash("Completá qué fue, el total y al menos dos personas");
    setBusy(true);
    const ok = await addShared({
      description: desc.trim(),
      date: todayAR(),
      category_id: cat,
      total: toDecimal(t),
      currency: "ARS",
      paid_by: paidBy,
      participants: among,
    });
    setBusy(false);
    if (ok) {
      flash("Gasto compartido guardado", "gasto");
      setDesc("");
      setTotal("");
    }
  };

  return (
    <section className={s.panel}>
      <strong className={s.panelTitle}>Nuevo gasto compartido</strong>
      <div className={s.nsGrid}>
        <label className={s.field}>
          Qué fue
          <input className={s.input} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. Cena, viaje, regalo" maxLength={80} />
        </label>
        <label className={s.field}>
          Total ($)
          <input className={s.input} value={total} onChange={(e) => setTotal(maskAmountEvent(e))} inputMode="decimal" placeholder="0" />
        </label>
        <label className={s.field}>
          Pagó
          <select className={s.input} value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {nameOf(id)}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          Categoría
          <select className={s.input} value={cat} onChange={(e) => setCat(e.target.value)}>
            {pickableCategories("out").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={s.field}>
        Entre
        <div className={s.chips}>
          {ids.map((id) => {
            const on = among.includes(id);
            return (
              <button key={id} className={s.chip} aria-pressed={on} onClick={() => setAmong(on ? among.filter((x) => x !== id) : [...among, id])}>
                <span className="material-symbols-rounded">{on ? "check_circle" : "radio_button_unchecked"}</span>
                {nameOf(id)}
              </button>
            );
          })}
        </div>
      </div>
      <span className={s.note}>
        {t && among.length
          ? `Cada uno pone ${formatMoney(t / among.length, "ARS")}.${among.includes("me") ? " Tu parte se suma a tus gastos del mes." : ""}`
          : "Elegí quién pagó y entre quiénes se divide."}
      </span>
      <button className={s.primary} style={{ alignSelf: "flex-end" }} onClick={submit} disabled={busy || !people.length}>
        {busy ? "Guardando…" : "Guardar gasto"}
      </button>
      {!people.length && <span className={s.note}>Agregá al menos un contacto para dividir gastos.</span>}
    </section>
  );
}
