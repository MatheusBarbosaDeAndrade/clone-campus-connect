-- LGPD: registro do aceite da Política de Privacidade e da anonimização
-- de contas excluídas a pedido do titular.
ALTER TABLE users
  ADD COLUMN privacy_accepted_at timestamptz,
  ADD COLUMN privacy_version varchar(20),
  ADD COLUMN anonymized_at timestamptz;
