"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GROUPS, VIEWS, groupOf, viewFromPath, type GroupId, type ViewId } from "@/lib/nav";
import { monthLabel } from "@/lib/month";
import { NewTxModal } from "@/components/tx/NewTxModal";
import { SaveErrorBar, TxDetail } from "@/components/tx/TxDetail";
import { ProfilePanel } from "./ProfilePanel";
import { initials, useShell } from "./ShellContext";
import s from "./shell.module.css";

const Icon = ({ name, className }: { name: string; className?: string }) => (
  <span className={`${s.icon} ${className ?? ""}`} aria-hidden>
    {name}
  </span>
);

function greeting() {
  const h = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const shell = useShell();
  const { user, months, month, setMonth, isPastMonth, toast, setProfileOpen, openNewTx, closeNewTx, newTxOpen, detailId, setDetailId, profileOpen, updatePrefs } =
    shell;

  const view = viewFromPath(pathname);
  const group = groupOf(view);
  // Última vista visitada de cada sección, para volver ahí al cambiar de sección.
  const [lastIn, setLastIn] = useState<Partial<Record<GroupId, ViewId>>>({});
  if (lastIn[group.id] !== view) setLastIn({ ...lastIn, [group.id]: view });

  const hrefOfGroup = (gid: GroupId) => {
    const g = GROUPS.find((x) => x.id === gid)!;
    const last = lastIn[gid];
    return VIEWS[last && g.views.includes(last) ? last : g.views[0]].href;
  };

  const mIdx = months.indexOf(month);
  const toggleTheme = () => updatePrefs({ theme: user.theme === "dark" ? "light" : "dark" });

  // Atajos: 1 a 4 cambian de sección, N abre Nuevo movimiento, T cambia el tema, Esc cierra paneles.
  const keyRef = useRef<(e: KeyboardEvent) => void>(undefined);
  const onShortcut = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeNewTx();
      setDetailId(null);
      return setProfileOpen(false);
    }
    // Con un panel abierto no hay atajos.
    if (newTxOpen || detailId || profileOpen || document.querySelector('[aria-modal="true"]')) return;
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? "";
    if (["input", "textarea", "select"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "n" && !isPastMonth) {
      e.preventDefault();
      openNewTx();
    } else if (k === "t") toggleTheme();
    else {
      const i = Number.parseInt(e.key, 10);
      if (i >= 1 && i <= GROUPS.length) router.push(hrefOfGroup(GROUPS[i - 1].id));
    }
  };
  useEffect(() => {
    keyRef.current = onShortcut;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current?.(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const firstName = user.name.split(" ")[0] || "hola";
  const ini = initials(user);
  const newTxTitle = isPastMonth ? "En un mes pasado no se puede cargar nada" : "Nuevo movimiento (N)";

  return (
    <div className={s.frame}>
      <aside className={s.sidebar} aria-label="Secciones">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/isotipo.svg" alt="Albolsillo" className={s.isotipo} />
        <nav style={{ display: "contents" }}>
          {GROUPS.map((g, i) => (
            <Link
              key={g.id}
              href={hrefOfGroup(g.id)}
              className={s.sideItem}
              aria-current={g.id === group.id ? "page" : undefined}
              title={`${g.label} (${i + 1})`}
            >
              <Icon name={g.icon} className={s.sideIcon} />
              <span className={s.sideLabel}>{g.short}</span>
            </Link>
          ))}
        </nav>
        <div className={s.spacer} />
        <button className={`${s.sideTool} ${s.icon}`} title="Configurar ingresos y deudas" onClick={() => shell.flash("El onboarding llega en un próximo paso.")}>
          tune
        </button>
        <button className={`${s.sideTool} ${s.icon}`} title={`${user.theme === "dark" ? "Tema claro" : "Tema oscuro"} (T)`} onClick={toggleTheme}>
          {user.theme === "dark" ? "light_mode" : "dark_mode"}
        </button>
        <button className={s.avatarBtn} title={`Perfil y configuración · ${user.email}`} onClick={() => setProfileOpen(true)}>
          {ini}
        </button>
      </aside>

      <main className={s.main}>
        <header className={s.header}>
          {view === "dash" ? (
            <div className={s.greet} title={user.email}>
              <span className={s.ring}>
                <span className={s.ringInner}>{ini[0]}</span>
              </span>
              <span className={s.greetText}>
                <span className={s.greetHello}>{greeting()}</span>
                <span className={s.greetName}>{firstName}</span>
              </span>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/isotipo.svg" alt="Albolsillo" className={s.mobLogo} />
              <h1 className={s.title}>{VIEWS[view].label}</h1>
            </>
          )}

          <div className={s.monthPicker}>
            <button className={`${s.monthArrow} ${s.icon}`} title="Mes anterior" disabled={mIdx <= 0} onClick={() => setMonth(months[mIdx - 1])}>
              chevron_left
            </button>
            <span className={s.monthLabel}>
              <Icon name="calendar_today" />
              <span className={s.full}>{monthLabel(month)}</span>
              <span className={s.short}>{monthLabel(month, true)}</span>
            </span>
            <button
              className={`${s.monthArrow} ${s.icon}`}
              title="Mes siguiente"
              disabled={mIdx >= months.length - 1}
              onClick={() => setMonth(months[mIdx + 1])}
            >
              chevron_right
            </button>
          </div>

          <div className={s.spacer} />

          <div className={`${s.segmented} ${s.full}`} role="group" aria-label="Mostrar montos en">
            {(["ARS", "USD"] as const).map((c) => (
              <button key={c} className={s.segBtn} aria-pressed={user.display_currency === c} onClick={() => updatePrefs({ display_currency: c })}>
                {c}
              </button>
            ))}
          </div>

          <button className={`${s.roundBtn} ${s.icon}`} title="Alertas" onClick={() => shell.flash("Nada urgente en estos días. Bolsi te banca.")}>
            notifications
          </button>

          <button className={`${s.avatarBtn} ${s.mobAvatar}`} title="Perfil y configuración" onClick={() => setProfileOpen(true)}>
            {ini}
          </button>
        </header>

        <div className={s.scroll}>
          <div className={s.content}>
            {group.views.length > 1 && (
              <nav className={s.subnav} aria-label={group.label}>
                {group.views.map((v) => (
                  <Link key={v} href={VIEWS[v].href} className={s.pill} aria-current={v === view ? "page" : undefined}>
                    <Icon name={VIEWS[v].icon} />
                    {VIEWS[v].label}
                  </Link>
                ))}
              </nav>
            )}
            {children}
          </div>
        </div>
      </main>

      <button className={`${s.fab} ${s.icon}`} title={newTxTitle} aria-label="Nuevo movimiento" disabled={isPastMonth} onClick={openNewTx}>
        add
      </button>

      <nav className={s.bottomNav} aria-label="Secciones">
        {[GROUPS[0], GROUPS[1], null, GROUPS[2], GROUPS[3]].map((g) =>
          g ? (
            <Link key={g.id} href={hrefOfGroup(g.id)} className={s.bottomItem} aria-current={g.id === group.id ? "page" : undefined}>
              <Icon name={g.icon} className={s.bottomIcon} />
              <span>{g.short}</span>
            </Link>
          ) : (
            <button key="add" className={s.addBtn} aria-label="Nuevo movimiento" title={newTxTitle} disabled={isPastMonth} onClick={openNewTx}>
              <Icon name="add" className={s.addIcon} />
            </button>
          ),
        )}
      </nav>

      {toast && (
        <div key={toast.id} className={s.toast} role="status">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/bolsi/bolsi-${toast.pose}.svg`} alt="" />
          {toast.message}
        </div>
      )}

      <ProfilePanel />
      <NewTxModal />
      <TxDetail />
      <SaveErrorBar />
    </div>
  );
}
