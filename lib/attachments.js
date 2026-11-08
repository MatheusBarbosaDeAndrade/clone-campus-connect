// Limite de tamanho dos anexos, compartilhado entre servidor e navegador.
// Padrão: 10 MB. Na Vercel, as funções aceitam no máximo 4,5 MB por
// requisição/resposta, então lá defina NEXT_PUBLIC_ATTACHMENT_MAX_MB=4
// (o build da Vercel falha se isso não for feito; ver infra/scripts/vercel-build.js).
// Por ser NEXT_PUBLIC_, o valor é embutido no código do navegador no build.
const DEFAULT_MAX_MB = 10;

const configured = Number(process.env.NEXT_PUBLIC_ATTACHMENT_MAX_MB);

export const ATTACHMENT_MAX_MB =
  Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_MB;

export const MAX_ATTACHMENT_BYTES = ATTACHMENT_MAX_MB * 1024 * 1024;
