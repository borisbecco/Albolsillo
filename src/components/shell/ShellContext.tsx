"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { UserDto } from "@/lib/auth/session";
import { currentMonth, navigableMonths } from "@/lib/month";

export type BolsiPose = "bienvenida" | "ingreso" | "gasto" | "meta" | "alerta" | "errorguardar";
export type Toast = { id: number; message: string; pose: BolsiPose };

type Prefs = Partial<Pick<UserDto, "theme" | "display_currency" | "rate_type" | "pay_strategy" | "alert_days" | "mail_alerts" | "name">>;

type Shell = {
  user: UserDto;
  setUser: (u: UserDto) => void;
  /** Paso en el que se abre el onboarding (0 Ingresos, 1 Tarjetas, 2 Gastos fijos, 3 Estrategia). */
  onboardingStep: number;
  setOnboardingStep: (n: number) => void;
  updatePrefs: (p: Prefs) => Promise<void>;
  months: string[];
  month: string;
  setMonth: (ym: string) => void;
  /** En un mes pasado no se puede cargar nada. */
  isPastMonth: boolean;
  toast: Toast | null;
  flash: (message: string, pose?: BolsiPose) => void;
  profileOpen: boolean;
  setProfileOpen: (v: boolean) => void;
  newTxOpen: boolean;
  openNewTx: () => void;
  closeNewTx: () => void;
  detailId: string | null;
  setDetailId: (id: string | null) => void;
  /** Formulario "Nueva cuenta" abierto (se puede abrir desde otras pantallas). */
  accountFormOpen: boolean;
  setAccountFormOpen: (v: boolean) => void;
  /** Filtro de Movimientos por cuenta (al tocar una cuenta). */
  movAccount: string | null;
  setMovAccount: (id: string | null) => void;
};

const Ctx = createContext<Shell | null>(null);

export const THEME_KEY = "ab-theme";

export function applyTheme(theme: UserDto["theme"]) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function ShellProvider({ initialUser, children }: { initialUser: UserDto; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const months = useMemo(() => navigableMonths(), []);
  const [month, setMonthState] = useState(() => currentMonth());
  const [toast, setToast] = useState<Toast | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((message: string, pose: BolsiPose = "bienvenida") => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, pose });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const updatePrefs = useCallback(
    async (p: Prefs) => {
      const prev = user;
      setUser((u) => ({ ...u, ...p }));
      if (p.theme) applyTheme(p.theme);
      try {
        const res = await api<{ user: UserDto }>("/me", { method: "PATCH", body: JSON.stringify(p) });
        setUser(res.user);
      } catch {
        setUser(prev);
        if (p.theme) applyTheme(prev.theme);
        flash("No pudimos guardar el cambio. Probá de nuevo.", "errorguardar");
      }
    },
    [user, flash],
  );

  const setMonth = useCallback((ym: string) => {
    if (months.includes(ym)) setMonthState(ym);
  }, [months]);

  const [newTxOpen, setNewTxOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [movAccount, setMovAccount] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const isPastMonth = month !== months[months.length - 1];
  const openNewTx = useCallback(() => {
    if (isPastMonth) return flash("En un mes pasado no se puede cargar nada.");
    setDetailId(null);
    setProfileOpen(false);
    setNewTxOpen(true);
  }, [isPastMonth, flash]);
  const closeNewTx = useCallback(() => setNewTxOpen(false), []);

  const value: Shell = {
    user,
    setUser,
    onboardingStep,
    setOnboardingStep,
    updatePrefs,
    months,
    month,
    setMonth,
    isPastMonth,
    toast,
    flash,
    profileOpen,
    setProfileOpen,
    newTxOpen,
    openNewTx,
    closeNewTx,
    detailId,
    setDetailId,
    accountFormOpen,
    setAccountFormOpen,
    movAccount,
    setMovAccount,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShell() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell fuera de ShellProvider");
  return c;
}

export function initials(user: Pick<UserDto, "name" | "email">) {
  const words = (user.name || user.email).trim().split(/[\s@.]+/).filter(Boolean);
  return (words.slice(0, user.name ? 2 : 1).map((w) => w[0]).join("") || "V").toUpperCase();
}
