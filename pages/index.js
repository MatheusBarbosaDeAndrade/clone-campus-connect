import Link from "next/link";
import { useRouter } from "next/router";
import AuthLayout, { AuthCardHeader } from "components/AuthLayout.js";
import { Alert, Button } from "components/ui.js";
import { redirectIfAuthenticated } from "lib/ssr.js";

export default function Welcome() {
  const router = useRouter();
  return (
    <AuthLayout title="Bem-vindo">
      {router.query.conta === "excluida" && (
        <Alert variant="success" className="mb-6">
          Sua conta foi excluída e seus dados pessoais foram apagados.
        </Alert>
      )}
      <AuthCardHeader
        title="Quer abrir um chamado?"
        subtitle="O CampusConnect centraliza e simplifica as solicitações de suporte e atendimento da sua instituição de ensino."
      />
      <div className="flex flex-col gap-3">
        <Button href="/cadastro">Cadastrar</Button>
        <Button href="/login" variant="secondary">
          Já tenho uma conta
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-slate-500">
        É da equipe de atendimento?{" "}
        <Link
          href="/gestor/login"
          className="font-bold text-slate-800 hover:underline"
        >
          Acesse o portal do gestor
        </Link>
      </p>
    </AuthLayout>
  );
}

export const getServerSideProps = redirectIfAuthenticated();
