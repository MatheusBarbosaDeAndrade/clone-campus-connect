-- Registro de tentativas para limitar abuso (força bruta no login, envio
-- em massa de e-mails de recuperação, cadastros automatizados).
-- A chave (email, telefone ou IP) é guardada como hash SHA-256, para não
-- manter dados pessoais em texto puro nesta tabela.
CREATE TABLE rate_limit_hits (
  id bigserial PRIMARY KEY,
  bucket varchar(40) NOT NULL,
  key_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_hits_lookup_idx
  ON rate_limit_hits (bucket, key_hash, created_at);
CREATE INDEX rate_limit_hits_created_at_idx ON rate_limit_hits (created_at);

-- Índices para a limpeza periódica de sessões e tokens vencidos.
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX password_reset_tokens_expires_at_idx
  ON password_reset_tokens (expires_at);
