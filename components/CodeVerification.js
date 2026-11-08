import { useEffect, useState } from "react";
import { AuthCardHeader } from "components/AuthLayout.js";
import { MailIcon } from "components/icons.js";
import { Alert, Button, TextField } from "components/ui.js";
import { apiRequest } from "lib/api.js";

const RESEND_WAIT_SECONDS = 30;

// Segunda etapa do acesso: o usuário digita o código de 6 dígitos enviado
// ao e-mail. `verification` é a resposta da API ({ challenge, email,
// expiresInMinutes }); `onResend` pede um novo código e devolve uma nova
// `verification`; `onVerified(role)` é chamado depois que a sessão é criada.
export default function CodeVerification({
  verification: initial,
  onResend,
  onVerified,
  onBack,
}) {
  const [verification, setVerification] = useState(initial);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT_SECONDS);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (code.length !== 6) {
      setFieldError("Informe o código de 6 dígitos.");
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      const { role } = await apiRequest("POST", "/api/v1/sessions/verify", {
        challenge: verification.challenge,
        code,
      });
      await onVerified(role);
    } catch (requestError) {
      if (requestError.field === "code") {
        setFieldError(requestError.message);
      } else {
        setError(requestError.message);
        if (requestError.status === 401) setExpired(true);
      }
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setFieldError(null);
    setResending(true);
    try {
      const next = await onResend();
      setVerification(next);
      setCode("");
      setExpired(false);
      setWait(RESEND_WAIT_SECONDS);
      setNotice("Enviamos um novo código. O anterior deixou de valer.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <AuthCardHeader
        icon={MailIcon}
        title="Verifique seu e-mail"
        subtitle={`Enviamos um código de 6 dígitos para ${verification.email}. Ele vale por ${verification.expiresInMinutes} minutos.`}
      />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}
        <TextField
          label="Código de verificação"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          placeholder="000000"
          inputClassName="text-center text-2xl font-bold tracking-[0.5em]"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          error={fieldError}
        />
        <Button type="submit" loading={loading} disabled={expired}>
          Confirmar
        </Button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-3 text-sm text-slate-600">
        <p>
          Não recebeu?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || wait > 0}
            className="font-bold text-slate-900 hover:underline disabled:cursor-not-allowed disabled:font-semibold disabled:text-slate-400 disabled:no-underline"
          >
            {wait > 0 ? `Reenviar código (${wait}s)` : "Reenviar código"}
          </button>
        </p>
        <p className="text-xs text-slate-500">
          Confira também a caixa de spam.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="font-semibold text-slate-700 hover:underline"
        >
          Voltar
        </button>
      </div>
    </>
  );
}
