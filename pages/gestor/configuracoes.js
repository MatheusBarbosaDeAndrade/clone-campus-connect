import { useRouter } from "next/router";
import { useState } from "react";
import AppShell from "components/AppShell.js";
import { CheckIcon, PencilIcon, TrashIcon, XIcon } from "components/icons.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  PRIORITY_DOT,
  PageHeader,
  SectionTitle,
  SelectField,
  TextField,
  Toggle,
  cx,
} from "components/ui.js";
import { apiRequest } from "lib/api.js";
import { withSession } from "lib/ssr.js";
import { PRIORITY_LABELS } from "lib/ticket-labels.js";
import assignmentRule from "models/assignment-rule.js";
import category from "models/category.js";
import settings from "models/settings.js";
import sla from "models/sla.js";
import user from "models/user.js";

function useAction(router, setFeedback) {
  const [busy, setBusy] = useState(null);
  async function run(key, fn, successText) {
    setBusy(key);
    setFeedback(null);
    try {
      await fn();
      await router.replace(router.asPath, undefined, { scroll: false });
      if (successText) setFeedback({ variant: "success", text: successText });
      return true;
    } catch (requestError) {
      setFeedback({ variant: "error", text: requestError.message });
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

function RulesSection({ rules, categories, staff, autoAssign, action }) {
  const empty = { name: "", categoryId: "", agentId: "" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});

  function validate(values) {
    const found = {};
    if (values.name.trim().length < 3) found.name = "Mínimo de 3 caracteres.";
    if (!values.categoryId) found.categoryId = "Selecione a categoria.";
    if (!values.agentId) found.agentId = "Selecione o agente.";
    return found;
  }

  async function create(event) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const ok = await action.run(
      "create-rule",
      () =>
        apiRequest("POST", "/api/v1/assignment-rules", {
          ...form,
          categoryId: Number(form.categoryId),
        }),
      "Regra criada.",
    );
    if (ok) setForm(empty);
  }

  async function saveEdit() {
    const found = validate(editing);
    if (Object.keys(found).length > 0) {
      setErrors({ edit: Object.values(found)[0] });
      return;
    }
    const ok = await action.run(
      `edit-${editing.id}`,
      () =>
        apiRequest("PATCH", `/api/v1/assignment-rules/${editing.id}`, {
          name: editing.name,
          categoryId: Number(editing.categoryId),
          agentId: editing.agentId,
        }),
      "Regra atualizada.",
    );
    if (ok) {
      setEditing(null);
      setErrors({});
    }
  }

  return (
    <Card className="p-6" id="atribuicao">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionTitle>Regras de Atribuição Automática</SectionTitle>
          <p className="text-sm text-slate-600">
            Direciona novos chamados de uma categoria para o agente responsável.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-600">
          Ativar atribuição
          <Toggle
            label="Ativar atribuição automática"
            checked={autoAssign}
            disabled={action.busy !== null}
            onChange={(value) =>
              action.run(
                "auto",
                () =>
                  apiRequest("PATCH", "/api/v1/settings", {
                    autoAssignEnabled: value,
                  }),
                value
                  ? "Atribuição automática ativada."
                  : "Atribuição automática desativada.",
              )
            }
          />
        </label>
      </div>

      {!autoAssign && rules.length > 0 && (
        <Alert variant="warning" className="mb-4">
          A atribuição automática está desativada: as regras abaixo não serão
          aplicadas.
        </Alert>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-slate-100 text-[11px] tracking-wide text-slate-600 uppercase">
              <th className="rounded-l-lg px-4 py-3 font-bold">Regra</th>
              <th className="px-4 py-3 font-bold">Categoria</th>
              <th className="px-4 py-3 font-bold">Agente responsável</th>
              <th className="rounded-r-lg px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            )}
            {rules.map((rule) =>
              editing?.id === rule.id ? (
                <tr key={rule.id}>
                  <td className="px-2 py-3">
                    <input
                      aria-label="Nome da regra"
                      value={editing.name}
                      onChange={(e) =>
                        setEditing((r) => ({ ...r, name: e.target.value }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 px-2"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <select
                      aria-label="Categoria da regra"
                      value={editing.categoryId}
                      onChange={(e) =>
                        setEditing((r) => ({
                          ...r,
                          categoryId: e.target.value,
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 px-2"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <select
                      aria-label="Agente da regra"
                      value={editing.agentId}
                      onChange={(e) =>
                        setEditing((r) => ({ ...r, agentId: e.target.value }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 px-2"
                    >
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={saveEdit}
                        aria-label="Salvar regra"
                        className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setErrors({});
                        }}
                        aria-label="Cancelar edição"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <XIcon />
                      </button>
                    </div>
                    {errors.edit && (
                      <p className="text-right text-xs text-red-600">
                        {errors.edit}
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                <tr key={rule.id}>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {rule.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-blue-100 text-blue-700">
                      {rule.category_name}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {rule.agent_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Toggle
                        label={`Ativar regra ${rule.name}`}
                        checked={rule.is_active}
                        disabled={action.busy !== null}
                        onChange={(value) =>
                          action.run(`toggle-${rule.id}`, () =>
                            apiRequest(
                              "PATCH",
                              `/api/v1/assignment-rules/${rule.id}`,
                              { isActive: value },
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Editar regra ${rule.name}`}
                        onClick={() =>
                          setEditing({
                            id: rule.id,
                            name: rule.name,
                            categoryId: String(rule.category_id),
                            agentId: rule.agent_id,
                          })
                        }
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir regra ${rule.name}`}
                        onClick={() => {
                          if (
                            window.confirm(`Excluir a regra "${rule.name}"?`)
                          ) {
                            action.run(
                              `delete-${rule.id}`,
                              () =>
                                apiRequest(
                                  "DELETE",
                                  `/api/v1/assignment-rules/${rule.id}`,
                                ),
                              "Regra excluída.",
                            );
                          }
                        }}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={create}
        noValidate
        className="mt-6 grid gap-4 border-t border-slate-100 pt-6 md:grid-cols-[1fr_1fr_1fr_auto] md:items-start"
      >
        <TextField
          label="Nova regra"
          placeholder="Ex.: Redes & Acesso"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name}
        />
        <SelectField
          label="Categoria"
          value={form.categoryId}
          onChange={(e) =>
            setForm((f) => ({ ...f, categoryId: e.target.value }))
          }
          error={errors.categoryId}
        >
          <option value="">Selecione...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Agente"
          value={form.agentId}
          onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
          error={errors.agentId}
        >
          <option value="">Selecione...</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <Button
          type="submit"
          size="md"
          loading={action.busy === "create-rule"}
          className="h-12 md:mt-7"
        >
          + Adicionar regra
        </Button>
      </form>
    </Card>
  );
}

function CategoriesSection({ categories, action }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);

  async function create(event) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Informe o nome da categoria.");
      return;
    }
    setError(null);
    const ok = await action.run(
      "create-category",
      () => apiRequest("POST", "/api/v1/categories", { name }),
      "Categoria criada.",
    );
    if (ok) setName("");
  }

  async function saveEdit() {
    const ok = await action.run(
      `cat-${editing.id}`,
      () =>
        apiRequest("PATCH", `/api/v1/categories/${editing.id}`, {
          name: editing.name,
        }),
      "Categoria renomeada.",
    );
    if (ok) setEditing(null);
  }

  return (
    <Card className="p-6" id="categorias">
      <SectionTitle className="mb-4">Gerenciamento de Categorias</SectionTitle>
      <ul className="flex flex-col gap-2">
        {categories.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2"
          >
            {editing?.id === item.id ? (
              <>
                <input
                  aria-label="Nome da categoria"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((c) => ({ ...c, name: e.target.value }))
                  }
                  className="h-8 flex-1 rounded border border-slate-300 bg-white px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  aria-label="Salvar categoria"
                  className="rounded p-1.5 text-emerald-600 hover:bg-white"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  aria-label="Cancelar"
                  className="rounded p-1.5 text-slate-500 hover:bg-white"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-900">
                  {item.name}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...item })}
                    aria-label={`Editar ${item.name}`}
                    className="rounded p-1.5 text-slate-600 hover:bg-white"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remover a categoria "${item.name}"? Chamados existentes manterão a categoria.`,
                        )
                      ) {
                        action.run(
                          `del-cat-${item.id}`,
                          () =>
                            apiRequest(
                              "DELETE",
                              `/api/v1/categories/${item.id}`,
                            ),
                          "Categoria removida.",
                        );
                      }
                    }}
                    aria-label={`Remover ${item.name}`}
                    className="rounded p-1.5 text-red-500 hover:bg-white"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={create} noValidate className="mt-4 flex gap-2">
        <TextField
          className="flex-1"
          placeholder="Nova categoria"
          aria-label="Nova categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          inputClassName="h-10"
        />
        <Button
          type="submit"
          size="md"
          loading={action.busy === "create-category"}
          className="h-10"
        >
          Adicionar
        </Button>
      </form>
    </Card>
  );
}

function SlaSection({ policies, action }) {
  const [editing, setEditing] = useState(false);
  const initial = Object.fromEntries(
    policies.map((p) => [p.priority, String(p.resolution_hours)]),
  );
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);

  async function save() {
    const parsed = {};
    for (const [priority, value] of Object.entries(values)) {
      const hours = Number(value);
      if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
        setError("Use números inteiros entre 1 e 720 horas.");
        return;
      }
      parsed[priority] = hours;
    }
    setError(null);
    const ok = await action.run(
      "sla",
      () => apiRequest("PUT", "/api/v1/sla-policies", parsed),
      "Prazos de SLA atualizados (chamados abertos recalculados).",
    );
    if (ok) setEditing(false);
  }

  return (
    <Card className="p-6" id="sla">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Configurações de SLA</SectionTitle>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setValues(initial);
              setEditing(true);
            }}
            className="text-sm font-bold text-blue-500 hover:underline"
          >
            EDITAR
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Prazo para resolução contado em horas corridas a partir da abertura.
      </p>
      <ul className="flex flex-col gap-3">
        {policies.map((policy) => (
          <li
            key={policy.priority}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 font-semibold text-slate-900">
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  PRIORITY_DOT[policy.priority],
                )}
              />
              {PRIORITY_LABELS[policy.priority]}
            </span>
            {editing ? (
              <span className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  min={1}
                  max={720}
                  aria-label={`Horas para ${PRIORITY_LABELS[policy.priority]}`}
                  value={values[policy.priority]}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [policy.priority]: e.target.value,
                    }))
                  }
                  className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right"
                />
                horas
              </span>
            ) : (
              <span className="font-semibold text-slate-900">
                {policy.resolution_hours} horas
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-3 text-xs font-medium text-red-600">{error}</p>
      )}
      {editing && (
        <div className="mt-5 flex gap-2">
          <Button size="md" onClick={save} loading={action.busy === "sla"}>
            Salvar
          </Button>
          <Button size="md" variant="outline" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Settings({
  viewer,
  unreadCount,
  rules,
  categories,
  staff,
  policies,
  autoAssign,
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(null);
  const action = useAction(router, setFeedback);

  return (
    <AppShell title="Configurações" viewer={viewer} unreadCount={unreadCount}>
      <PageHeader
        title="Configurações do Console"
        subtitle="Ajuste regras automáticas, categorias e acordos de nível de serviço"
      />
      {feedback && (
        <Alert variant={feedback.variant} className="mb-6">
          {feedback.text}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_480px]">
        <RulesSection
          rules={rules}
          categories={categories}
          staff={staff}
          autoAssign={autoAssign}
          action={action}
        />
        <div className="flex flex-col gap-6">
          <CategoriesSection categories={categories} action={action} />
          <SlaSection
            key={policies.map((p) => p.resolution_hours).join("-")}
            policies={policies}
            action={action}
          />
        </div>
      </div>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async () => {
    const [rules, categories, staff, policies, autoAssign] = await Promise.all([
      assignmentRule.list(),
      category.listActive(),
      user.listStaff(),
      sla.listPolicies(),
      settings.get("auto_assign_enabled"),
    ]);
    return {
      rules,
      categories,
      staff,
      policies,
      autoAssign: autoAssign === true,
    };
  },
  { roles: ["manager"], loginPath: "/gestor/login" },
);
