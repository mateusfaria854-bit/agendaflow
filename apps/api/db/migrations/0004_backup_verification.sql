-- Sinal minimo para observabilidade de copias verificadas, sem segredos ou nomes de objetos S3.
CREATE TABLE IF NOT EXISTS backup_verifications (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  verified_at TIMESTAMPTZ NOT NULL,
  archive_size_bytes BIGINT NOT NULL CHECK (archive_size_bytes > 0),
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$')
);
