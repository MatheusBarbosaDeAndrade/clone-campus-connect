import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AuthLayout, {
  AuthCardHeader,
  BackToWelcome,
} from "components/AuthLayout.js";
import CodeVerification from "components/CodeVerification.js";
import {
  Alert,
  Button,
  FieldError,
  PasswordField,
  TextField,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { maskPhone } from "lib/format.js";
import { redirectIfAuthenticated } from "lib/ssr.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form) {
  const errors = {};
  if (form.name.trim().length < 3) errors.name = "Informe seu nome completo.";
  const phoneDigits = form.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) errors.phone = "Informe um telefone com DDD.";
  if (!EMAIL_REGEX.test(form.email.trim()))
    errors.email = "Informe um email válido.";
  if (form.password.length < 8)
    errors.password = "A senha deve ter pelo menos 8 caracteres.";
  if (!form.acceptPrivacy)
    errors.acceptPrivacy =
      "É preciso aceitar a Política de Privacidade para criar a conta.";
  return errors;
}

export default function SignUp() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    acceptPrivacy: false,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState(null);

  function update(field) {
    return (event) => {
      const value =
        field === "phone" ? maskPhone(event.target.value) : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setLoading(true);
    try {
      const created = await apiRequest("POST", "/api/v1/users", form);
      setVerification(created.verification);
      setLoading(false);
    } catch (requestError) {
      if (requestError.field) {
        setErrors({ [requestError.field]: requestError.message });
      } else {
        setError(requestError.message);
      }
      setLoading(false);
    }
  }

  if (verification) {
    return (
      <AuthLayout title="Confirmar E-mail">
        <CodeVerification
          verification={verification}
          // A conta já existe: um novo código é pedido pelo login normal.
          onResend={() =>
            apiRequest("POST", "/api/v1/sessions", {
              login: form.email,
              password: form.password,
              portal: "user",
            })
          }
          onVerified={() => router.push("/inicio")}
          onBack={() => router.push("/login")}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Criar Conta">
      <AuthCardHeader
        align="left"
        title="Criar Conta"
        subtitle="Cadastre-se para acessar o suporte"
      />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Nome"
          name="name"
          autoComplete="name"
          placeholder="Digite seu nome completo"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
        />
        <TextField
          label="Telefone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChange={update("phone")}
          error={errors.phone}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="seuemail@instituicao.edu.br"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
        />
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
        />
        <div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name="acceptPrivacy"
              checked={form.acceptPrivacy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  acceptPrivacy: event.target.checked,
                }))
              }
              aria-invalid={Boolean(errors.acceptPrivacy)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
            />
            <span>
              Li e concordo com a{" "}
              <Link
                href="/privacidade"
                target="_blank"
                className="font-bold text-slate-900 underline"
              >
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          {errors.acceptPrivacy && (
            <FieldError>{errors.acceptPrivacy}</FieldError>
          )}
        </div>
        <Button type="submit" loading={loading}>
          Cadastrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="font-bold text-slate-900 hover:underline"
        >
          Entrar
        </Link>
      </p>
      <BackToWelcome />
    </AuthLayout>
  );
}

export const getServerSideProps = redirectIfAuthenticated();
