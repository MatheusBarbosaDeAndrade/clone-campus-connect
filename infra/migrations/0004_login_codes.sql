-- Verificação em duas etapas por e-mail: depois da senha correta (ou do
-- cadastro), o sistema envia um código de 6 dígitos e só cria a sessão
-- quando o código é confirmado.
-- `challenge_hash` identifica a tentativa de login no navegador (o valor
-- original fica só no cliente) e `code_hash` guarda o código; ambos em
-- SHA-256, para que um vazamento da tabela não permita entrar nas contas.
CREATE TABLE login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_hash char(64) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  remember boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_codes_user_id_idx ON login_codes (user_id);
CREATE INDEX login_codes_expires_at_idx ON login_codes (expires_at);
