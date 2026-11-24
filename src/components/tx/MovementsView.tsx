"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_BY_ID, catColor } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { MONTH_FULL, MONTH_SHORT } from "@/lib/month";
import { EMPTY } from "@/lib/nav";
import { useData, type Tx } from "@/components/data/DataContext";
import { EmptyState } from "@/components/shell/EmptyState";
import { useShell } from "@/components/shell/ShellContext";
import { ACCOUNT_KINDS } from "@/components/accounts/kinds";
import { CatIcon, todayAR } from "./parts";
import m from "./movements.module.css";

const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
type TypeFilter = "all" | "out" | "in";

function dayLabel(ymd: string) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const wd = WD[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${wd} ${d} ${MONTH_SHORT[mo - 1]}${ymd === todayAR() ? " · Hoy" : ""}`;
}

export function MovementsView() {
  const { month, user, setDetailId, movAccount, setMovAccount } = useShell();
  const { transactions, accounts, toDisplay } = useData();
  const accFilter = accounts.find((x) => x.id === movAccount) ?? null;
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [cat, setCat] = useState("all");

  const inMonth = useMemo(() => transactions.filter((t) => t.date.startsWith(month)), [transactions, month]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inMonth.filter(
      (t) =>
        (!accFilter || t.account_id === accFilter.id) &&
        (type === "all" || t.type === type) &&
        (cat === "all" || t.category_id === cat) &&
        (!needle || t.description.toLowerCase().includes(needle) || CATEGORY_BY_ID[t.category_id]?.name.toLowerCase().includes(needle)),
    );
  }, [inMonth, q, type, cat, accFilter]);

  const cur = user.display_currency;
  const sumOf = (list: Tx[], ty: "in" | "out") => list.filter((t) => t.type === ty).reduce((s, t) => s + toDisplay(Number(t.amount), t.currency), 0);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()].map(([date, rows]) => ({
      date,
      rows,
      net: rows.reduce((s, t) => s + (t.type === "in" ? 1 : -1) * toDisplay(Number(t.amount), t.currency), 0),
    }));
  }, [filtered, toDisplay]);

  if (!transactions.length) return <EmptyState copy={EMPTY.mov!} />;

  if (!inMonth.length) {
    const name = MONTH_FULL[Number(month.slice(5)) - 1].toLowerCase();
    return (
      <EmptyState
        copy={{
          ...EMPTY.mov!,
          title: `Sin movimientos en ${name}`,
          text: "Cambiá de mes arriba o cargá un gasto de este mes.",
          cta2: undefined,
          tips: undefined,
        }}
      />
    );
  }

  return (
    <div className={m.wrap}>
      <div className={m.toolbar}>
        <label className={m.search}>
          <span className="material-symbols-rounded">search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar movimiento o comercio" aria-label="Buscar" />
        </label>
        <div className={m.typeSeg} role="group" aria-label="Tipo">
          {(
            [
              ["all", "Todos"],
              ["out", "Gastos"],
              ["in", "Ingresos"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} aria-pressed={type === v} onClick={() => setType(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {accFilter && (
        <div>
          <button className={m.accFilter} onClick={() => setMovAccount(null)} title="Quitar filtro">
            <span className="material-symbols-rounded">{ACCOUNT_KINDS[accFilter.kind].icon}</span>
            {accFilter.name}
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
      )}

      <div className={m.cats} role="group" aria-label="Categoría">
        {[{ id: "all", name: "Todas", icon: "apps" }, ...CATEGORIES].map((c) => (
          <button key={c.id} className={m.catChip} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            <span className={`${m.catDot} material-symbols-rounded`} style={cat === c.id ? undefined : { color: c.id === "all" ? "var(--acc2)" : catColor(c.id) }}>
              {c.icon}
            </span>
            {c.name}
          </button>
        ))}
      </div>

      <div className={m.summary}>
        <div className={m.kpi}>
          <span>Movimientos</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className={m.kpi}>
          <span>Ingresos</span>
          <strong style={{ color: "var(--pos)" }}>{formatMoney(sumOf(filtered, "in"), cur)}</strong>
        </div>
        <div className={m.kpi}>
          <span>Gastos</span>
          <strong>{formatMoney(sumOf(filtered, "out"), cur)}</strong>
        </div>
      </div>

      <section className={m.list}>
        {groups.map((g) => (
          <div key={g.date}>
            <div className={m.dayHead}>
              <span>{dayLabel(g.date)}</span>
              <span className={m.dayTotal}>{formatMoney(g.net, cur, { sign: true })}</span>
            </div>
            {g.rows.map((t) => (
              <button key={t.id} className={m.row} onClick={() => setDetailId(t.id)}>
                <CatIcon id={t.category_id} />
                <span className={m.rowMain}>
                  <span className={m.rowDesc}>{t.description}</span>
                  <span className={m.rowCat}>
                    {CATEGORY_BY_ID[t.category_id]?.name}
                    {t.recurring ? "  ↻" : ""}
                  </span>
                </span>
                {t.status !== "synced" && (
                  <span
                    className={`material-symbols-rounded ${m.status}`}
                    data-status={t.status}
                    title={t.status === "failed" ? "No se pudo guardar" : "Guardando…"}
                  >
                    {t.status === "failed" ? "cloud_off" : "schedule"}
                  </span>
                )}
                <span className={m.rowAmount} style={{ color: t.type === "in" ? "var(--pos)" : "var(--fg)" }}>
                  {t.type === "in" ? "+" : "−"}
                  {formatMoney(Number(t.amount), t.currency)}
                </span>
                <span className={`material-symbols-rounded ${m.chev}`}>chevron_right</span>
              </button>
            ))}
          </div>
        ))}
        {!groups.length && (
          <div className={m.noResults}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/bolsi/bolsi-bienvenida.svg" alt="" width={72} height={79} />
            <span>No hay movimientos con estos filtros.</span>
          </div>
        )}
      </section>
    </div>
  );
}
