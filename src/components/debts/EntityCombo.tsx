"use client";

import { useId, useMemo, useState } from "react";
import { AR_ENTITIES, entityDomain, norm, type Entity, type EntityKind } from "@/lib/entities";
import { Logo } from "@/components/shell/Logo";
import d from "./debts.module.css";

const RANK: Record<EntityKind, number> = { banco: 0, billetera: 1, tarjeta: 2 };
const GROUP: Record<EntityKind, string> = { banco: "Bancos", billetera: "Billeteras", tarjeta: "Tarjetas" };
const ALL = [...AR_ENTITIES].sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.name.localeCompare(b.name, "es"));

/**
 * Buscador de banco o billetera. Elegís de la lista (con logo) o escribís uno que no está.
 * `onChange` recibe el nombre elegido o escrito ("" si se borra).
 */
export function EntityCombo({ value, onChange, kinds }: { value: string; onChange: (v: string) => void; kinds?: readonly EntityKind[] }) {
  const SORTED = useMemo(() => (kinds ? ALL.filter((e) => kinds.includes(e.kind)) : ALL), [kinds]);
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const list = useMemo(() => {
    const nq = norm(q);
    // Con el nombre ya elegido mostramos todo (para cambiarlo fácil).
    if (!nq || SORTED.some((e) => e.name === q)) return SORTED;
    return SORTED.filter((e) => norm(e.name).includes(nq) || e.match.test(q));
  }, [q, SORTED]);
  const free = q.trim() && !SORTED.some((e) => norm(e.name) === norm(q)) ? q.trim() : null;
  const options: (Entity | string)[] = free ? [...list, free] : list;

  const pick = (o: Entity | string) => {
    const v = typeof o === "string" ? o : o.name;
    setQ(v);
    onChange(v);
    setOpen(false);
  };

  const domain = entityDomain(value);

  return (
    <div className={d.combo}>
      <div className={d.comboField}>
        {domain ? <Logo domain={domain} icon="account_balance" size={24} /> : <span className="material-symbols-rounded">search</span>}
        <input
          className={d.comboInput}
          value={q}
          placeholder="Buscá tu banco o billetera"
          aria-label="Entidad"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          onFocus={(e) => {
            setOpen(true);
            e.target.select();
          }}
          onClick={(e) => {
            // Ya elegido y con la lista cerrada: al tocarlo de nuevo se reemplaza lo escrito.
            if (!open) {
              setOpen(true);
              e.currentTarget.select();
            }
          }}
          onBlur={() => {
            setOpen(false);
            // Lo escrito queda como entidad aunque no esté en la lista.
            const exact = SORTED.find((e) => norm(e.name) === norm(q));
            const v = exact ? exact.name : q.trim();
            setQ(v);
            if (v !== value) onChange(v);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(options.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              pick(options[active]);
            } else if (e.key === "Escape" && open) {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      {open && (
        <div className={d.comboList} role="listbox" id={listId}>
          {options.map((o, i) => {
            const isFree = typeof o === "string";
            const name = isFree ? o : o.name;
            const prevKind = i > 0 && typeof options[i - 1] !== "string" ? (options[i - 1] as Entity).kind : null;
            return (
              <div key={isFree ? "__free" : name}>
                {!isFree && o.kind !== prevKind && <span className={d.comboGroup}>{GROUP[o.kind]}</span>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={d.comboItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o)}
                >
                  {isFree ? <span className="material-symbols-rounded">add</span> : <Logo domain={o.domain} icon="account_balance" size={26} />}
                  <span>{isFree ? `Usar «${name}»` : name}</span>
                  {name === value && <span className="material-symbols-rounded">check</span>}
                </button>
              </div>
            );
          })}
          {!options.length && <span className={d.comboNone}>Escribí el nombre de la entidad</span>}
        </div>
      )}
    </div>
  );
}
