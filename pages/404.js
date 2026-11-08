import Head from "next/head";
import { LogoBadge } from "components/AuthLayout.js";
import { Button } from "components/ui.js";

export default function NotFound() {
  return (
    <>
      <Head>
        <title>Página não encontrada · CampusConnect</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <LogoBadge />
        <h1 className="mt-6 text-3xl font-extrabold text-slate-900">
          Página não encontrada
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-600">
          O endereço acessado não existe ou você não tem permissão para
          visualizá-lo.
        </p>
        <Button href="/" size="md" className="mt-6">
          Voltar ao início
        </Button>
      </main>
    </>
  );
}
