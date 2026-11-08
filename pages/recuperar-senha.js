import Link from "next/link";
import { useState } from "react";
import AuthLayout, { AuthCardHeader } from "components/AuthLayout.js";
import { Alert, Button, TextField } from "components/ui.js";
import { apiRequest } from "lib/api.js";

export default function PasswordRecovery() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError("Informe um email válido.");
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      await apiRequest("POST", "/api/v1/password-reset", { email });
      setSent(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Recuperar Senha">
      <AuthCardHeader
        title="Recuperar Senha"
        subtitle="Digite seu email para receber o link de recuperação de acesso."
      />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="seuemail@instituicao.edu.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
        />
        <Button type="submit" loading={loading}>
          Enviar link
        </Button>
        {sent && (
          <Alert variant="success">
            Link enviado! Verifique seu email. (Se o endereço estiver
            cadastrado, você receberá as instruções em instantes.)
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Lembrou a senha?{" "}
        <Link
          href="/login"
          className="font-bold text-slate-900 hover:underline"
        >
          Voltar ao login
        </Link>
      </p>
    </AuthLayout>
  );
}
