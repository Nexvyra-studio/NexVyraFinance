"use client";

import {
  ArrowLeftRight, ChartLine, CreditCard, Eye, EyeOff, House, LoaderCircle, Moon, Plus, Settings, Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useFinance } from "@/store/finance-store";
import { AuthScreen } from "./auth-screen";
import { Logo } from "./logo";
import { usePrefs } from "./prefs";
import { useSheets } from "./sheets";
import { UserAvatar } from "./user-avatar";
import { Button, IconButton, cx } from "./ui";

const NAV = [
  { href: "/", label: "Início", icon: House },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/futuro", label: "Futuro", icon: ChartLine },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function AppShell({ children }: { children: ReactNode }) {
  const { status, toast } = useFinance();
  const path = usePathname();
  const { openNew } = useSheets();

  if (status !== "ready") return <Gate />;

  return (
    <div className="min-h-dvh md:flex">
      {/* sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <div className="px-2">
          <Logo />
        </div>
        <Button size="lg" className="mt-8" onClick={() => openNew()}>
          <Plus size={20} strokeWidth={2.5} /> Novo lançamento
        </Button>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition",
                isActive(path, href) ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <SidebarUser active={path.startsWith("/perfil")} />
          <div className="flex gap-1 px-1">
            <PrivacyButton />
            <ThemeButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-clip pb-28 md:pb-12">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-8">{children}</div>
      </main>

      {/* barra inferior mobile */}
      <nav className="fixed inset-x-0 pb-[env(safe-area-inset-bottom)] bottom-0 z-40 border-t border-line bg-bg/85 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
          {NAV.slice(0, 2).map((n) => (
            <TabLink key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Novo lançamento"
              onClick={() => openNew()}
              className="-mt-6 grid size-14 place-items-center rounded-[22px] bg-brand text-accent-ink shadow-[0_8px_24px_-6px_rgb(10_108_255/0.6)] transition active:scale-90"
            >
              <Plus size={28} strokeWidth={2.5} />
            </button>
          </div>
          {NAV.slice(2, 4).map((n) => (
            <TabLink key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
        </div>
      </nav>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
          <div className="anim-pop rounded-2xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg shadow-soft">{toast}</div>
        </div>
      )}
    </div>
  );
}

function TabLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link href={href} className={cx("flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold transition", active ? "text-fg" : "text-faint")}>
      <span className={cx("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-surface-2")}>
        <Icon size={20} strokeWidth={active ? 2.4 : 2} />
      </span>
      {label}
    </Link>
  );
}

export function PrivacyButton() {
  const { hideValues, toggleHideValues } = usePrefs();
  return (
    <IconButton label={hideValues ? "Mostrar valores" : "Esconder valores"} onClick={toggleHideValues}>
      {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
    </IconButton>
  );
}

export function ThemeButton() {
  const { theme, setTheme } = usePrefs();
  return (
    <IconButton label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </IconButton>
  );
}

/** Avatar no topo (celular) que abre o perfil */
function HeaderAvatar() {
  const { user, source } = useFinance();
  if (source !== "firebase" || !user) return null;
  return (
    <Link href="/perfil" aria-label="Meu perfil" className="ml-1 rounded-full transition active:scale-95 md:hidden">
      <UserAvatar user={user} size={34} />
    </Link>
  );
}

/** Usuário no rodapé do menu lateral (desktop) */
function SidebarUser({ active }: { active: boolean }) {
  const { user, source } = useFinance();
  if (source !== "firebase" || !user) return null;
  return (
    <Link
      href="/perfil"
      className={cx(
        "flex items-center gap-3 rounded-2xl p-2 transition",
        active ? "bg-surface-2" : "hover:bg-surface-2/60",
      )}
    >
      <UserAvatar user={user} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{user.name || "Meu perfil"}</span>
        <span className="block truncate text-xs text-muted">{user.email}</span>
      </span>
    </Link>
  );
}

/** Cabeçalho das páginas (no mobile traz os atalhos de privacidade e ajustes) */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 pb-2 pt-[calc(env(safe-area-inset-top)+1.25rem)] md:pt-8">
      <div className="min-w-0">
        {subtitle && <p className="text-sm font-medium text-muted">{subtitle}</p>}
        <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center">
        {actions}
        <span className="md:hidden">
          <PrivacyButton />
        </span>
        <Link href="/ajustes" aria-label="Ajustes" className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 md:hidden">
          <Settings size={20} />
        </Link>
        <HeaderAvatar />
      </div>
    </header>
  );
}

/* ------------------------- telas de carregamento/login ------------------------- */

function Gate() {
  const { status, error } = useFinance();
  if (status === "signed-out") return <AuthScreen />;
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Logo big />
        {status === "loading" && <LoaderCircle className="mt-10 animate-spin text-accent-text" />}
        {status === "error" && (
          <div className="mt-8 rounded-2xl border border-expense/30 bg-expense/10 p-4 text-sm text-expense">{error}</div>
        )}
      </div>
    </div>
  );
}
