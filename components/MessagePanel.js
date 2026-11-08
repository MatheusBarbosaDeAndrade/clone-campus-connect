import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  SectionTitle,
  cx,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatDayAndTime } from "lib/format.js";
import { ROLE_LABELS } from "lib/ticket-labels.js";

// Painel de conversa. Com `internal`, funciona como "Notas Internas".
export default function MessagePanel({
  ticketId,
  messages,
  now,
  onSent,
  internal = false,
  disabledReason,
  title,
  className,
  placeholder,
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Escreva uma mensagem antes de enviar.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await apiRequest("POST", `/api/v1/tickets/${ticketId}/messages`, {
        body,
        internal,
      });
      setBody("");
      await onSent?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className={cx("flex flex-col p-6", className)}>
      <SectionTitle className="mb-4 text-base">
        {title || (internal ? "Notas Internas" : "Mensagens")} (
        {messages.length})
      </SectionTitle>
      <div
        ref={listRef}
        className="flex max-h-[480px] flex-1 flex-col gap-4 overflow-y-auto"
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            {internal
              ? "Nenhuma nota interna registrada."
              : "Nenhuma mensagem ainda."}
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="flex items-start gap-3">
            <Avatar
              name={message.author_name}
              size="sm"
              tone={message.author_role === "user" ? "muted" : "dark"}
            />
            <div className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-bold text-slate-900">
                  {message.author_name}
                  {message.author_role !== "user" &&
                    ` (${ROLE_LABELS[message.author_role]})`}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {formatDayAndTime(message.created_at, now)}
                </span>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap text-slate-700">
                {message.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {disabledReason ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {disabledReason}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4">
          {error && <Alert className="mb-3">{error}</Alert>}
          <div className="rounded-xl border border-slate-200 bg-white p-2 focus-within:ring-2 focus-within:ring-slate-300">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={5000}
              rows={internal ? 2 : 1}
              placeholder={
                placeholder ||
                (internal
                  ? "Escreva uma nota interna privada..."
                  : "Escreva uma mensagem...")
              }
              aria-label={internal ? "Nova nota interna" : "Nova mensagem"}
              className="w-full resize-none px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !internal) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] text-slate-400">
                {internal ? "Apenas a equipe visualizará" : ""}
              </span>
              <Button type="submit" size="sm" loading={sending} caps={false}>
                {internal ? "Salvar" : "Enviar"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}
