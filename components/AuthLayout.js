import Head from "next/head";
import Link from "next/link";
import { ChevronLeftIcon, GraduationCapIcon } from "components/icons.js";
import { cx } from "components/ui.js";

export function LogoBadge({
  icon: Icon = GraduationCapIcon,
  size = "md",
  tone = "dark",
}) {
  const sizes = {
    sm: "h-11 w-11 [&>svg]:h-6 [&>svg]:w-6",
    md: "h-16 w-16 [&>svg]:h-8 [&>svg]:w-8",
    lg: "h-24 w-24 [&>svg]:h-12 [&>svg]:w-12",
  };
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full text-white",
        tone === "dark" ? "bg-brand" : "bg-white/10",
        sizes[size],
      )}
    >
      <Icon strokeWidth={1.5} />
    </span>
  );
}

// Layout dividido das telas públicas (boas-vindas, login, cadastro...).
export default function AuthLayout({ title, variant = "user", children }) {
  const isStaff = variant === "staff";
  return (
    <>
      <Head>
        <title>{`${title} · CampusConnect`}</title>
      </Head>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="flex flex-col items-center justify-between bg-brand px-6 py-10 text-center text-white lg:min-h-screen lg:w-1/2 lg:py-16">
          <div className="flex flex-col items-center">
            <Link
              href={isStaff ? "/gestor/login" : "/"}
              aria-label="CampusConnect"
            >
              <LogoBadge size="lg" tone="light" />
            </Link>
            {isStaff && (
              <span className="mt-4 rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-bold tracking-wide">
                PORTAL DO GESTOR
              </span>
            )}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              CampusConnect
            </h1>
            <p className="mt-4 max-w-md text-base text-slate-300 sm:text-lg">
              {isStaff
                ? "Gerencie chamados, acompanhe métricas de SLA e lidere a melhoria do atendimento acadêmico em um só lugar."
                : "O portal de suporte e atendimento integrado para simplificar a sua jornada acadêmica."}
            </p>
          </div>
          <p className="mt-8 text-xs tracking-wide text-slate-400 uppercase">
            <span className="hidden lg:inline">
              © {new Date().getFullYear()} CampusConnect. Todos os direitos
              reservados. ·{" "}
            </span>
            <Link
              href="/privacidade"
              className="hover:text-white hover:underline"
            >
              Política de Privacidade
            </Link>
          </p>
        </aside>
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2">
          <div className="w-full max-w-[480px] rounded-3xl bg-white p-6 shadow-sm sm:p-10">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}

export function AuthCardHeader({ icon, title, subtitle, align = "center" }) {
  if (align === "left") {
    return (
      <div className="mb-6 flex items-center gap-3">
        <LogoBadge size="sm" icon={icon} />
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{subtitle}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <LogoBadge icon={icon} />
      <h2 className="mt-5 text-2xl font-extrabold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

// Link de volta à página de boas-vindas ("Quer abrir um chamado?").
export function BackToWelcome() {
  return (
    <p className="mt-4 text-center text-sm">
      <Link
        href="/"
        className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 hover:underline"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Voltar à página inicial
      </Link>
    </p>
  );
}
