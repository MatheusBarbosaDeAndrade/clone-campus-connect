import { useRouter } from "next/router";
import { useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  PasswordField,
  TextField,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatPhone, maskPhone } from "lib/format.js";
import { ROLE_LABELS } from "lib/ticket-labels.js";

export default function ProfileForm({ viewer, logoutRedirect }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: viewer.name,
    phone: formatPhone(viewer.phone),
    currentPassword: "",
    newPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field) {
    return (event) => {
      const value =
        field === "phone" ? maskPhone(event.target.value) : event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (form.name.trim().length < 3) found.name = "Informe seu nome completo.";
    const digits = form.phone.replace(/\D/g, "");
    if (viewer.role === "user" && digits.length < 10)
      found.phone = "Informe um telefone com DDD.";
    else if (digits.length > 0 && digits.length < 10)
      found.phone = "Telefone inválido.";
    if (form.newPassword || form.currentPassword) {
      if (!form.currentPassword)
        found.currentPassword = "Informe a senha atual.";
      if (form.newPassword.length < 8)
        found.newPassword = "A nova senha deve ter pelo menos 8 caracteres.";
    }
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone };
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }
      await apiRequest("PATCH", "/api/v1/user", payload);
      setForm((current) => ({
        ...current,
        currentPassword: "",
        newPassword: "",
      }));
      setMessage({
        variant: "success",
        text: "Alterações salvas com sucesso.",
      });
      await router.replace(router.asPath, undefined, { scroll: false });
    } catch (requestError) {
      if (requestError.field) {
        setErrors({ [requestError.field]: requestError.message });
      } else {
        setMessage({ variant: "error", text: requestError.message });
      }
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await apiRequest("DELETE", "/api/v1/sessions");
    } finally {
      router.push(logoutRedirect);
    }
  }

  return (
    <Card className="p-6 sm:p-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Avatar name={viewer.name} size="xl" tone="dark" />
        <p className="mt-4 text-lg font-bold text-slate-900">{viewer.name}</p>
        <p className="text-sm text-slate-600">{viewer.email}</p>
        {viewer.role !== "user" && (
          <span className="mt-2 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
            {ROLE_LABELS[viewer.role]}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <h2 className="text-sm font-extrabold tracking-wide text-slate-900 uppercase">
          Informações pessoais
        </h2>
        <TextField
          label="Nome Completo"
          autoComplete="name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
          inputClassName="bg-slate-50"
        />
        <TextField
          label="Telefone"
          type="tel"
          autoComplete="tel"
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChange={update("phone")}
          error={errors.phone}
          inputClassName="bg-slate-50"
        />
        <h2 className="mt-3 text-sm font-extrabold tracking-wide text-slate-900 uppercase">
          Segurança
        </h2>
        <PasswordField
          label="Senha Atual"
          autoComplete="current-password"
          placeholder="Necessária apenas para trocar a senha"
          value={form.currentPassword}
          onChange={update("currentPassword")}
          error={errors.currentPassword}
        />
        <PasswordField
          label="Nova Senha"
          autoComplete="new-password"
          placeholder="Digite a nova senha"
          value={form.newPassword}
          onChange={update("newPassword")}
          error={errors.newPassword}
        />
        {message && <Alert variant={message.variant}>{message.text}</Alert>}
        <Button type="submit" loading={saving} className="mt-2">
          Salvar alterações
        </Button>
        <button
          type="button"
          onClick={logout}
          className="text-sm font-bold text-red-500 hover:text-red-600"
        >
          Sair da Conta
        </button>
      </form>
    </Card>
  );
}
