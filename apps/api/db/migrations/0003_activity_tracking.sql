-- Marca a atividade das contas para impedir expurgo de usuários que retornaram recentemente.
-- O default concede uma janela integral de retenção às contas já existentes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS users_demo_retention_index ON users (last_activity_at, created_at)
  WHERE role = 'CLIENTE';
