import Link from "next/link";
import AuthLayout, {
  AuthCardHeader,
  BackToWelcome,
} from "components/AuthLayout.js";
import LoginForm from "components/LoginForm.js";
import { redirectIfAuthenticated } from "lib/ssr.js";

export default function Login() {
  return (
    <AuthLayout title="Entrar">
      <LoginForm
        portal="user"
        header={
          <AuthCardHeader
            title="Acesse o Portal"
            subtitle="Entre com suas credenciais institucionais"
          />
        }
        footer={
          <>
            <p className="mt-6 text-center text-sm text-slate-600">
              Não tem conta?{" "}
              <Link
                href="/cadastro"
                className="font-bold text-slate-900 hover:underline"
              >
                Cadastre-se
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
