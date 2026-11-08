import { useRouter } from "next/router";
import { useState } from "react";
import { BellIcon } from "components/icons.js";
import { Alert, Card, EmptyState, PageHeader, cx } from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatRelative } from "lib/format.js";

export default function NotificationList({
  notifications,
  now,
  ticketBasePath,
}) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter((n) => !n.read_at).length;

  async function refresh() {
    await router.replace(router.asPath, undefined, { scroll: false });
  }

  async function markAll() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest("PATCH", "/api/v1/notifications", { all: true });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function open(item) {
    setError(null);
    try {
      if (!item.read_at)
        await apiRequest("PATCH", "/api/v1/notifications", { id: item.id });
      if (item.ticket_id) {
        await router.push(`${ticketBasePath}/${item.ticket_id}`);
      } else {
        await refresh();
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Acompanhe novidades, atualizações e avisos do portal"
        actions={
          <>
            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-800">
              Não lidas ({unread})
            </span>
            <button
              type="button"
              onClick={markAll}
              disabled={busy || unread === 0}
              className="text-sm font-bold text-slate-900 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              Marcar todas como lidas
            </button>
          </>
        }
      />
      {error && <Alert className="mb-4">{error}</Alert>}
      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma notificação por aqui"
            description="Você será avisado quando houver atualizações nos chamados."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className={cx(
                  "flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-colors hover:border-slate-300 sm:px-5",
                  item.read_at
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-100",
                )}
              >
                <span
                  className={cx(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    item.read_at
                      ? "bg-slate-100 text-slate-500"
                      : "bg-blue-100 text-blue-700",
                  )}
                >
                  <BellIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={cx(
                        "text-[15px] text-slate-900",
                        item.read_at ? "font-semibold" : "font-bold",
                      )}
                    >
                      {item.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                      {formatRelative(item.created_at, now)}
                      {!item.read_at && (
                        <span
                          className="h-2 w-2 rounded-full bg-red-500"
                          aria-label="Não lida"
                        />
                      )}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {item.body}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
