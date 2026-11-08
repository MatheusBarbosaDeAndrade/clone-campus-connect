import Link from "next/link";
import AuthLayout, {
  AuthCardHeader,
  BackToWelcome,
} from "components/AuthLayout.js";
import { AlertCircleIcon, ShieldIcon } from "components/icons.js";
import LoginForm from "components/LoginForm.js";
import { redirectIfAuthenticated } from "lib/ssr.js";

export default function ManagerLogin() {
  return (
    <AuthLayout title="Acesso do Gestor" variant="staff">
      <LoginForm
        portal="staff"
        header={
          <AuthCardHeader
            icon={ShieldIcon}
            title="Acesso do Gestor"
            subtitle="Entre com suas credenciais de administrador"
          />
        }
        footer={
          <>
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-600">
              <AlertCircleIcon className="h-4 w-4 shrink-0" />
              Acesso restrito a gestores e agentes autorizados.
            </div>
            <p className="mt-4 text-center text-sm text-slate-600">
              É aluno ou professor?{" "}
              <Link
                href="/login"
                className="font-bold text-slate-900 hover:underline"
              >
                Acesse o portal do usuário
              </Link>
            </p>
            <BackToWelcome />
          </>
        }
      />
    </AuthLayout>
  );
}

export const getServerSideProps = redirectIfAuthenticated();
