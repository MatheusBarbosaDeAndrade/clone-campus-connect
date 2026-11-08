import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  BellIcon,
  ClockIcon,
  FileTextIcon,
  GraduationCapIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  PlusCircleIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "components/icons.js";
import { Avatar, cx } from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { firstAndLastName } from "lib/format.js";
import { ROLE_LABELS } from "lib/ticket-labels.js";

const USER_NAV = [
  { href: "/inicio", label: "Início", icon: HomeIcon },
  { href: "/chamados/novo", label: "Novo Chamado", icon: PlusCircleIcon },
  {
    href: "/chamados",
    label: "Meus Chamados",
    icon: FileTextIcon,
    match: /^\/chamados(\/\[id\])?$/,
  },
  { href: "/notificacoes", label: "Avisos", icon: BellIcon, badge: true },
  { href: "/perfil", label: "Perfil", icon: UserIcon },
];

const STAFF_NAV = [
  { href: "/gestor", label: "Painel Geral", icon: HomeIcon },
  {
    href: "/gestor/fila",
    label: "Fila de Chamados",
    icon: FileTextIcon,
    match: /^\/gestor\/(fila|chamados)/,
  },
  { href: "/gestor/equipe", label: "Equipe", icon: UsersIcon },
  { href: "/gestor/sla", label: "SLA & Escalações", icon: ClockIcon },
  {
    href: "/gestor/notificacoes",
    label: "Notificações",
    icon: BellIcon,
    badge: true,
  },
  {
    href: "/gestor/configuracoes",
    label: "Configurações",
    icon: SettingsIcon,
    managerOnly: true,
  },
  { href: "/gestor/perfil", label: "Meu Perfil", icon: UserIcon },
];

function isActive(item, pathname) {
  if (item.match) return item.match.test(pathname);
  return pathname === item.href;
}

export default function AppShell({
  title,
  viewer,
  unreadCount = 0,
  children,
  width = "full",
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isStaff = viewer.role !== "user";
  const nav = (isStaff ? STAFF_NAV : USER_NAV).filter(
    (item) => !item.managerOnly || viewer.role === "manager",
  );

  async function logout() {
    setLoggingOut(true);
    try {
      await apiRequest("DELETE", "/api/v1/sessions");
    } finally {
      router.push(isStaff ? "/gestor/login" : "/");
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-brand px-6 py-8 text-white">
      <Link
        href={isStaff ? "/gestor" : "/inicio"}
        className="mb-10 flex items-center gap-3"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
          <GraduationCapIcon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <span>
          <span className="block text-lg leading-tight font-bold">
            CampusConnect
          </span>
          {isStaff && (
            <span className="block text-[11px] font-medium tracking-wide text-slate-400 uppercase">
              Console Gestão
            </span>
          )}
        </span>
      </Link>

      <nav className="flex flex-col gap-2" aria-label="Navegação principal">
        {nav.map((item) => {
          const active = isActive(item, router.pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] transition-colors",
                active
                  ? "bg-white/10 font-bold text-white"
                  : "font-medium text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge && unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-3 pt-8">
        <Avatar name={viewer.name} tone={isStaff ? "auto" : "muted"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">
            {firstAndLastName(viewer.name)}
          </div>
          <div className="flex items-center gap-2">
            {isStaff && (
              <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                {ROLE_LABELS[viewer.role]}
              </span>
            )}
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              Sair do Sistema
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Head>
        <title>{`${title} · CampusConnect`}</title>
      </Head>
      <div className="min-h-screen lg:flex">
        {/* Barra superior (telas pequenas) */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-brand px-4 py-3 text-white lg:hidden">
          <Link
            href={isStaff ? "/gestor" : "/inicio"}
            className="flex items-center gap-2 font-bold"
          >
            <GraduationCapIcon className="h-6 w-6" strokeWidth={1.75} />
            CampusConnect
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="relative rounded-lg p-2 hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <MenuIcon className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
        </header>

        {/* Menu lateral móvel */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="absolute top-4 right-4 z-10 rounded-lg p-2 text-white hover:bg-white/10"
                aria-label="Fechar menu"
              >
                <XIcon />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        {/* Sidebar fixa (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-70 shrink-0 lg:block">
          {sidebar}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div
            className={cx(
              "mx-auto",
              width === "narrow"
                ? "max-w-3xl"
                : width === "medium"
                  ? "max-w-4xl"
                  : "max-w-[1600px]",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
