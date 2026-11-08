-- Esquema inicial do CampusConnect.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(11),
  password_hash text NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'agent', 'manager')),
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE UNIQUE INDEX users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id serial PRIMARY KEY,
  name varchar(60) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX categories_active_name_unique
  ON categories (lower(name)) WHERE is_active;

CREATE TABLE sla_policies (
  priority varchar(10) PRIMARY KEY
    CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  resolution_hours integer NOT NULL
    CHECK (resolution_hours > 0 AND resolution_hours <= 720),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id serial PRIMARY KEY,
  title varchar(150) NOT NULL,
  description text NOT NULL,
  category_id integer NOT NULL REFERENCES categories (id),
  priority varchar(10) NOT NULL
    CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
  status varchar(15) NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_analise', 'em_andamento', 'aguardando', 'fechado', 'reaberto')),
  requester_id uuid NOT NULL REFERENCES users (id),
  assignee_id uuid REFERENCES users (id),
  sla_started_at timestamptz NOT NULL DEFAULT now(),
  sla_due_at timestamptz NOT NULL,
  first_response_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_requester_id_idx ON tickets (requester_id);
CREATE INDEX tickets_assignee_id_idx ON tickets (assignee_id);
CREATE INDEX tickets_status_idx ON tickets (status);

-- Histórico de alterações de cada chamado (linha do tempo).
CREATE TABLE ticket_events (
  id bigserial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users (id),
  type varchar(30) NOT NULL,
  from_value text,
  to_value text,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_events_ticket_id_idx ON ticket_events (ticket_id);

-- Mensagens (públicas) e notas internas (is_internal = true, só equipe).
CREATE TABLE ticket_messages (
  id bigserial PRIMARY KEY,
  ticket_id integer NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users (id),
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_messages_ticket_id_idx ON ticket_messages (ticket_id);

CREATE TABLE ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id integer NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES users (id),
  filename varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  size_bytes integer NOT NULL,
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ticket_attachments_ticket_id_idx ON ticket_attachments (ticket_id);

CREATE TABLE notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type varchar(30) NOT NULL,
  title varchar(120) NOT NULL,
  body text NOT NULL,
  ticket_id integer REFERENCES tickets (id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_idx ON notifications (user_id, created_at DESC);

CREATE TABLE assignment_rules (
  id serial PRIMARY KEY,
  name varchar(80) NOT NULL,
  category_id integer NOT NULL REFERENCES categories (id),
  agent_id uuid NOT NULL REFERENCES users (id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
  key varchar(50) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dados de configuração iniciais (vindos das referências visuais).
INSERT INTO sla_policies (priority, resolution_hours) VALUES
  ('critica', 2),
  ('alta', 8),
  ('media', 24),
  ('baixa', 72);

INSERT INTO categories (name) VALUES
  ('Infraestrutura'),
  ('Acadêmico'),
  ('Financeiro'),
  ('Biblioteca'),
  ('TI / Sistemas'),
  ('Secretaria');

INSERT INTO app_settings (key, value) VALUES
  ('auto_assign_enabled', 'false'::jsonb);
