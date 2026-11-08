import { useRef, useState } from "react";
import { DownloadIcon, PaperclipIcon } from "components/icons.js";
import { Alert, Button, Card, SectionTitle } from "components/ui.js";
import { uploadFile } from "lib/api.js";
import { ATTACHMENT_MAX_MB, MAX_ATTACHMENT_BYTES } from "lib/attachments.js";
import { formatBytes } from "lib/format.js";

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "application/pdf"];
export const MAX_FILE_BYTES = MAX_ATTACHMENT_BYTES;

export function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type))
    return `"${file.name}": envie PNG, JPG ou PDF.`;
  if (file.size > MAX_FILE_BYTES)
    return `"${file.name}" ultrapassa ${ATTACHMENT_MAX_MB} MB.`;
  return null;
}

export default function AttachmentsCard({
  ticketId,
  attachments,
  canUpload,
  onUploaded,
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setError(null);
    for (const file of files) {
      const problem = validateFile(file);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setUploading(true);
    try {
      for (const file of files) {
        await uploadFile(`/api/v1/tickets/${ticketId}/attachments`, file);
      }
      await onUploaded?.();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle className="text-base">
          Anexos ({attachments.length})
        </SectionTitle>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
            <Button
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <PaperclipIcon className="h-4 w-4" />
              Anexar arquivo
            </Button>
          </>
        )}
      </div>
      {error && <Alert className="mb-3">{error}</Alert>}
      {attachments.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum arquivo anexado.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {attachment.filename}
                </p>
                <p className="text-xs text-slate-500">
                  {formatBytes(attachment.size_bytes)} • enviado por{" "}
                  {attachment.uploader_name}
                </p>
              </div>
              <a
                href={`/api/v1/attachments/${attachment.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <DownloadIcon className="h-4 w-4" />
                Abrir
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
