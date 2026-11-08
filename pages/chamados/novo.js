import { useRouter } from "next/router";
import { ATTACHMENT_MAX_MB } from "lib/attachments.js";
import { useRef, useState } from "react";
import AppShell from "components/AppShell.js";
import { validateFile } from "components/AttachmentsCard.js";
import { UploadCloudIcon, XIcon } from "components/icons.js";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Label,
  SelectField,
  TextArea,
  TextField,
  cx,
} from "components/ui.js";
import { apiRequest, uploadFile } from "lib/api.js";
import { formatBytes } from "lib/format.js";
import { withSession } from "lib/ssr.js";
import { PRIORITIES, PRIORITY_LABELS } from "lib/ticket-labels.js";
import category from "models/category.js";
import sla from "models/sla.js";

export default function NewTicket({
  viewer,
  unreadCount,
  categories,
  policies,
}) {
  const router = useRouter();
  const fileInput = useRef(null);
  const [form, setForm] = useState({
    title: "",
    categoryId: "",
    description: "",
    priority: "media",
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const slaHours = policies.find(
    (p) => p.priority === form.priority,
  )?.resolution_hours;

  function update(field) {
    return (event) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function addFiles(list) {
    const incoming = Array.from(list || []);
    for (const file of incoming) {
      const problem = validateFile(file);
      if (problem) {
        setErrors((current) => ({ ...current, files: problem }));
        return;
      }
    }
    if (files.length + incoming.length > 10) {
      setErrors((current) => ({
        ...current,
        files: "Envie no máximo 10 arquivos.",
      }));
      return;
    }
    setErrors((current) => ({ ...current, files: undefined }));
    setFiles((current) => [...current, ...incoming]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = {};
    if (form.title.trim().length < 5)
      found.title = "O assunto deve ter pelo menos 5 caracteres.";
    if (!form.categoryId) found.categoryId = "Selecione o setor ou categoria.";
    if (form.description.trim().length < 10)
      found.description = "Descreva o problema com pelo menos 10 caracteres.";
    setErrors(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    let created;
    try {
      created = await apiRequest("POST", "/api/v1/tickets", {
        ...form,
        categoryId: Number(form.categoryId),
      });
    } catch (requestError) {
      if (requestError.field)
        setErrors({ [requestError.field]: requestError.message });
      else setError(requestError.message);
      setSubmitting(false);
      return;
    }

    let failed = 0;
    for (const file of files) {
      try {
        await uploadFile(`/api/v1/tickets/${created.id}/attachments`, file);
      } catch {
        failed += 1;
      }
    }
    await router.push(
      `/chamados/${created.id}?criado=1${failed > 0 ? `&falhas=${failed}` : ""}`,
    );
  }

  return (
    <AppShell
      title="Novo Chamado"
      viewer={viewer}
      unreadCount={unreadCount}
      width="medium"
    >
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Novo Chamado
        </h1>
        <p className="text-sm text-slate-600">
          Prazo de atendimento (SLA): {slaHours ? `${slaHours}h` : "—"}
        </p>
      </div>
      <Card className="p-6 sm:p-10">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-6"
        >
          {error && <Alert>{error}</Alert>}
          <TextField
            label="Assunto"
            placeholder="Resuma o problema em uma frase"
            maxLength={150}
            value={form.title}
            onChange={update("title")}
            error={errors.title}
          />
          <SelectField
            label="Categoria"
            value={form.categoryId}
            onChange={update("categoryId")}
            error={errors.categoryId}
            muted={!form.categoryId}
          >
            <option value="">Selecione o setor ou categoria...</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id} className="text-slate-900">
                {item.name}
              </option>
            ))}
          </SelectField>
          <TextArea
            label="Descrição"
            placeholder="Descreva em detalhes o seu problema ou solicitação..."
            maxLength={5000}
            value={form.description}
            onChange={update("description")}
            error={errors.description}
          />
          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-slate-900">
              Prioridade
            </legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
              {PRIORITIES.map((priority) => (
                <label
                  key={priority}
                  className={cx(
                    "cursor-pointer rounded-lg py-2 text-center text-sm transition has-focus-visible:ring-2 has-focus-visible:ring-slate-400",
                    form.priority === priority
                      ? "bg-white font-bold text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={priority}
                    checked={form.priority === priority}
                    onChange={update("priority")}
                    className="sr-only"
                  />
                  {PRIORITY_LABELS[priority]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label>Anexo</Label>
            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                addFiles(event.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center transition hover:border-slate-400 hover:bg-slate-50"
            >
              <UploadCloudIcon
                className="h-8 w-8 text-slate-400"
                strokeWidth={1.5}
              />
              <span className="mt-2 text-sm font-bold text-slate-700">
                Clique ou arraste para anexar arquivos
              </span>
              <span className="mt-1 text-xs text-slate-400">
                PNG, JPG ou PDF (Máx. {ATTACHMENT_MAX_MB} MB cada)
              </span>
            </button>
            <FieldError>{errors.files}</FieldError>
            {files.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium text-slate-800">
                      {file.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {formatBytes(file.size)}
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        className="rounded p-1 hover:bg-slate-200"
                        aria-label={`Remover ${file.name}`}
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="submit" loading={submitting}>
            Enviar chamado
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}

export const getServerSideProps = withSession(
  async () => ({
    categories: await category.listActive(),
    policies: await sla.listPolicies(),
  }),
  { roles: ["user"] },
);
