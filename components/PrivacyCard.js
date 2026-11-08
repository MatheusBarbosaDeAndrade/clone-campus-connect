import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { Alert, Button, Card, PasswordField } from "components/ui.js";
import { apiRequest } from "lib/api.js";

// Direitos do titular (LGPD): baixar os próprios dados e excluir a conta.
export default function PrivacyCard({ viewer }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const canDelete = viewer.role === "user";

  async function deleteAccount(event) {
    event.preventDefault();
    if (!currentPassword) {
      setError("Informe sua senha para confirmar.");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiRequest("DELETE", "/api/v1/user", { currentPassword });
      await router.push("/?conta=excluida");
    } catch (requestError) {
      setError(requestError.message);
      setDeleting(false);
    }
  }

  return (
    <Card className="mt-6 p-6 sm:p-10">
      <h2 className="text-sm font-extrabold tracking-wide text-slate-900 uppercase">
        Privacidade e dados
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Veja como tratamos seus dados na{" "}
        <Link
          href="/privacidade"
          className="font-bold text-slate-900 hover:underline"
        >
          Política de Privacidade
        </Link>
        .
      </p>
      <div className="mt-5 flex flex-col gap-3">
        <Button
          variant="outline"
          href="/api/v1/user/export"
          prefetch={false}
          download
        >
          Baixar meus dados (JSON)
        </Button>

        {canDelete && !confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm font-bold text-red-500 hover:text-red-600"
          >
            Excluir minha conta
          </button>
        )}
      </div>

      {canDelete && confirming && (
        <form
          onSubmit={deleteAccount}
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <p className="text-sm text-red-800">
            <strong>Esta ação não pode ser desfeita.</strong> Seu nome, email e
            telefone serão apagados e você não poderá mais entrar. Os chamados
            que você abriu continuam no histórico do atendimento como
            &quot;Usuário removido&quot;. Se quiser uma cópia, baixe seus dados
            antes.
          </p>
          <PasswordField
            label="Confirme sua senha"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="danger" loading={deleting}>
              Excluir definitivamente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirming(false);
                setError(null);
                setCurrentPassword("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
