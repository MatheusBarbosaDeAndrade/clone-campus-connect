import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AuthLayout, { AuthCardHeader } from "components/AuthLayout.js";
import { Alert, Button, PasswordField } from "components/ui.js";
import { apiRequest } from "lib/api.js";

export default function ResetPassword() {
  const router = useRouter();
  const token =
    typeof router.query.token === "string" ? router.query.token : "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (password.length < 8)
      found.password = "A senha deve ter pelo menos 8 caracteres.";
    if (confirmation !== password)
      found.confirmation = "As senhas não coincidem.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      await apiRequest("PATCH", "/api/v1/password-reset", { token, password });
      setDone(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Redefinir Senha">
      <AuthCardHeader
        title="Redefinir Senha"
        subtitle="Escolha uma nova senha para sua conta."
      />
      {done ? (
        <div className="flex flex-col gap-5">
          <Alert variant="success">Senha redefinida com sucesso!</Alert>
          <Button href="/login">Ir para o login</Button>
        </div>
      ) : router.isReady && !token ? (
        <div className="flex flex-col gap-5">
          <Alert>Link de recuperação inválido.</Alert>
          <Button href="/recuperar-senha">Solicitar novo link</Button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
          {error && (
            <Alert>
              {error}{" "}
              <Link href="/recuperar-senha" className="underline">
                Solicitar novo link
              </Link>
            </Alert>
          )}
          <PasswordField
            label="Nova senha"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <PasswordField
            label="Confirme a nova senha"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={errors.confirmation}
          />
          <Button type="submit" loading={loading}>
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
