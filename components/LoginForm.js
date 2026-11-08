import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import CodeVerification from "components/CodeVerification.js";
import { LockIcon, MailIcon } from "components/icons.js";
import { Alert, Button, PasswordField, TextField } from "components/ui.js";
import { apiRequest, safeNextPath } from "lib/api.js";

// `header` e `footer` ficam ocultos na etapa do código enviado por e-mail.
export default function LoginForm({ portal, header, footer }) {
  const router = useRouter();
  const isStaff = portal === "staff";
  const [form, setForm] = useState({
    login: "",
    password: "",
    remember: false,
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState(null);

  function update(field) {
    return (event) => {
      const value =
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};
    if (!form.login.trim())
      errors.login = "Informe seu email" + (isStaff ? "." : " ou telefone.");
    if (!form.password) errors.password = "Informe sua senha.";
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      setVerification(await requestCode());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function requestCode() {
    return apiRequest("POST", "/api/v1/sessions", { ...form, portal });
  }

  async function goToHome(role) {
    const fallback = role === "user" ? "/inicio" : "/gestor";
    const next = safeNextPath(router.query.next, fallback);
    // Evita mandar um usuário para uma área que não é a dele.
    const destination =
      (role === "user") === next.startsWith("/gestor") ? fallback : next;
    await router.push(destination);
  }

  if (verification) {
    return (
      <CodeVerification
        verification={verification}
        onResend={requestCode}
        onVerified={goToHome}
        onBack={() => {
          setVerification(null);
          setForm((current) => ({ ...current, password: "" }));
        }}
      />
    );
  }

  return (
    <>
      {header}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        <TextField
          label={isStaff ? "Email Institucional" : "Email ou Telefone"}
          name="login"
          autoComplete="username"
          placeholder={
            isStaff ? "gestor@instituicao.edu.br" : "nome@instituicao.edu.br"
          }
          leftIcon={isStaff ? MailIcon : undefined}
          value={form.login}
          onChange={update("login")}
          error={fieldErrors.login}
        />
        <div>
          <PasswordField
            label="Senha"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            leftIcon={isStaff ? LockIcon : undefined}
            value={form.password}
            onChange={update("password")}
            error={fieldErrors.password}
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={update("remember")}
                className="h-4 w-4 rounded border-slate-300 accent-slate-800"
              />
              Lembrar-me
            </label>
            <Link
              href="/recuperar-senha"
              className="text-sm font-semibold text-slate-700 hover:underline"
            >
              Esqueceu a senha?
            </Link>
          </div>
        </div>
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>
      {footer}
    </>
  );
}
