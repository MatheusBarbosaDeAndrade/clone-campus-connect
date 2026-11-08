import { useRouter } from "next/router";
import { useState } from "react";
import AppShell from "components/AppShell.js";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  PRIORITY_DOT,
  PageHeader,
  PasswordField,
  SectionTitle,
  SelectField,
  TextField,
  cx,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { formatDuration } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import { PRIORITIES, PRIORITY_LABELS, ROLE_LABELS } from "lib/ticket-labels.js";
import metrics from "models/metrics.js";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function presence(lastSeenAt, now) {
  if (!lastSeenAt) return { label: "Offline", dot: "bg-slate-400" };
  const minutes = (new Date(now) - new Date(lastSeenAt)) / 60000;
  if (minutes < 5) return { label: "Online", dot: "bg-emerald-500" };
  if (minutes < 30) return { label: "Ausente", dot: "bg-amber-500" };
  return { label: "Offline", dot: "bg-slate-400" };
}

function WeeklyChart({ data }) {
  const width = 700;
  const height = 220;
  const padding = { top: 16, bottom: 32, left: 32, right: 16 };
  const max = Math.max(4, ...data.map((d) => d.total));
  const step =
    (width - padding.left - padding.right) / Math.max(1, data.length - 1);
  const y = (value) =>
    padding.top + (1 - value / max) * (height - padding.top - padding.bottom);
  const points = data.map((d, i) => [padding.left + i * step, y(d.total)]);
  const line = points.map(([px, py]) => `${px},${py}`).join(" ");
  const area = `${padding.left},${y(0)} ${line} ${padding.left + (data.length - 1) * step},${y(0)}`;
  const gridValues = [0, Math.round(max / 2), max];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Chamados resolvidos por dia nos últimos 7 dias"
    >
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(value)}
            y2={y(value)}
            className="stroke-slate-200"
            strokeDasharray="4 4"
          />
          <text
            x={padding.left - 8}
            y={y(value) + 4}
            textAnchor="end"
            className="fill-slate-400 text-[11px]"
          >
            {value}
          </text>
        </g>
      ))}
      <polygon points={area} className="fill-blue-50" />
      <polyline
        points={line}
        fill="none"
        className="stroke-blue-500"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {points.map(([px, py], i) => (
        <g key={data[i].day}>
          <circle
            cx={px}
            cy={py}
            r="4"
            className="fill-white stroke-blue-500"
            strokeWidth="2"
          />
          <text
            x={px}
            y={py - 10}
            textAnchor="middle"
            className="fill-slate-700 text-[11px] font-bold"
          >
            {data[i].total}
          </text>
          <text
            x={px}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-400 text-[11px] font-semibold"
          >
            {WEEKDAYS[new Date(`${data[i].day}T12:00:00Z`).getUTCDay()]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function AddMemberForm({ onCreated }) {
  const empty = { name: "", email: "", password: "", role: "agent" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (form.name.trim().length < 3) found.name = "Informe o nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      found.email = "Email inválido.";
    if (form.password.length < 8) found.password = "Mínimo de 8 caracteres.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/v1/team", form);
      setForm(empty);
      await onCreated(`${form.name} foi adicionado(a) à equipe.`);
    } catch (requestError) {
      if (requestError.field)
        setErrors({ [requestError.field]: requestError.message });
      else setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const update = (field) => (event) =>
    setForm((f) => ({ ...f, [field]: event.target.value }));

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_180px_auto] xl:items-start"
    >
      {error && <Alert className="md:col-span-2 xl:col-span-5">{error}</Alert>}
      <TextField
        label="Nome"
        value={form.name}
        onChange={update("name")}
        error={errors.name}
      />
      <TextField
        label="Email"
        type="email"
        value={form.email}
        onChange={update("email")}
        error={errors.email}
      />
      <PasswordField
        label="Senha inicial"
        autoComplete="new-password"
        value={form.password}
        onChange={update("password")}
        error={errors.password}
      />
      <SelectField label="Papel" value={form.role} onChange={update("role")}>
        <option value="agent">Agente</option>
        <option value="manager">Gestor</option>
      </SelectField>
      <Button type="submit" size="md" loading={saving} className="h-12 xl:mt-7">
        Adicionar
      </Button>
    </form>
  );
}

export default function Team({ viewer, unreadCount, now, team }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const isManager = viewer.role === "manager";
  const active = team.members.filter((m) => m.is_active);

  async function refresh(message) {
    await router.replace(router.asPath, undefined, { scroll: false });
    if (message) setFeedback({ variant: "success", text: message });
  }

  async function updateMember(member, payload) {
    if (
      payload.isActive === false &&
      !window.confirm(
        `Desativar ${member.name}? Os chamados abertos dele(a) voltarão para a fila.`,
      )
    ) {
      return;
    }
    setBusyId(member.id);
    setFeedback(null);
    try {
      await apiRequest("PATCH", `/api/v1/team/${member.id}`, payload);
      await refresh("Equipe atualizada.");
    } catch (requestError) {
      setFeedback({ variant: "error", text: requestError.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Equipe" viewer={viewer} unreadCount={unreadCount}>
      <PageHeader
        title="Equipe & Desempenho"
        subtitle="Carga de trabalho atual e métricas de produtividade"
      />
      {feedback && (
        <Alert variant={feedback.variant} className="mb-6">
          {feedback.text}
        </Alert>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {active.map((member) => {
          const status = presence(member.last_seen_at, now);
          return (
            <Card key={member.id} className="p-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Avatar name={member.name} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">
                    {member.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={cx("h-2 w-2 rounded-full", status.dot)} />
                    {status.label} • {ROLE_LABELS[member.role]}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-between">
                <div>
                  <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    Chamados
                  </div>
                  <div className="font-bold text-slate-900">
                    {member.active} ativos
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    TMR médio
                  </div>
                  <div className="font-bold text-slate-900">
                    {formatDuration(member.avg_resolution_seconds)}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <SectionTitle className="mb-5">
            Distribuição de Chamados por Agente
          </SectionTitle>
          <ul className="flex flex-col gap-5">
            {active.map((member) => (
              <li key={member.id}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {member.name}
                  </span>
                  <span className="font-bold text-slate-900">
                    {member.total} chamados
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                  {member.total > 0 &&
                    PRIORITIES.slice()
                      .reverse()
                      .map((p) =>
                        member[p] ? (
                          <div
                            key={p}
                            className={PRIORITY_DOT[p]}
                            style={{
                              width: `${(member[p] / member.total) * 100}%`,
                            }}
                            title={`${PRIORITY_LABELS[p]}: ${member[p]}`}
                          />
                        ) : null,
                      )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-slate-600">
            {PRIORITIES.slice()
              .reverse()
              .map((p) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span
                    className={cx("h-2.5 w-2.5 rounded-full", PRIORITY_DOT[p])}
                  />
                  {PRIORITY_LABELS[p]}
                </span>
              ))}
          </div>
        </Card>
        <Card className="p-6">
          <SectionTitle className="mb-5">
            Desempenho Semanal (Chamados Resolvidos)
          </SectionTitle>
          <WeeklyChart data={team.weekly} />
        </Card>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Card className="flex items-center justify-between p-5">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Tempo médio da primeira resposta
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {formatDuration(team.avg_first_response_seconds)}
            </div>
          </div>
        </Card>
        <Card className="flex items-center justify-between p-5">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Taxa de reabertura
            </div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {team.reopen_rate_percent === null
                ? "—"
                : `${String(team.reopen_rate_percent).replace(".", ",")}%`}
            </div>
          </div>
          <Badge className="bg-slate-100 text-slate-600">
            Chamados reabertos ÷ fechados
          </Badge>
        </Card>
      </div>

      {isManager && (
        <Card className="p-6">
          <SectionTitle className="mb-1">Gerenciar Equipe</SectionTitle>
          <p className="mb-5 text-sm text-slate-600">
            Cadastre agentes e gestores, altere papéis ou desative acessos.
          </p>
          <AddMemberForm onCreated={refresh} />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="pb-3 font-semibold">Membro</th>
                  <th className="w-44 pb-3 font-semibold">Papel</th>
                  <th className="w-28 pb-3 font-semibold">Situação</th>
                  <th className="w-36 pb-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {team.members.map((member) => {
                  const self = member.id === viewer.id;
                  return (
                    <tr key={member.id}>
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">
                          {member.name}
                          {self && " (você)"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {member.email}
                        </div>
                      </td>
                      <td className="py-3">
                        <select
                          aria-label={`Papel de ${member.name}`}
                          value={member.role}
                          disabled={
                            self || busyId === member.id || !member.is_active
                          }
                          onChange={(event) =>
                            updateMember(member, { role: event.target.value })
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          <option value="agent">Agente</option>
                          <option value="manager">Gestor</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <Badge
                          className={
                            member.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }
                        >
                          {member.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        {!self && (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={busyId === member.id}
                            onClick={() =>
                              updateMember(member, {
                                isActive: !member.is_active,
                              })
                            }
                          >
                            {member.is_active ? "Desativar" : "Reativar"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async () => ({ team: await metrics.team() }),
  { roles: ["agent", "manager"], loginPath: "/gestor/login" },
);
