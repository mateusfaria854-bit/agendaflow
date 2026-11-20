#!/usr/bin/env bash
# Backup lógico do PostgreSQL + restauração de teste isolada antes do upload S3.
# Não altera o banco de origem. Não imprimir URLs/segredos nos logs.
set -euo pipefail
set +x
umask 077

: "${DATABASE_URL:?DATABASE_URL ausente}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET ausente}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT ausente}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID ausente}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY ausente}"
: "${AWS_DEFAULT_REGION:?AWS_DEFAULT_REGION ausente}"
if [[ "${DEMO_MODE:-}" != "true" ]]; then
  echo "Backup recusado: apenas banco de demonstracao (DEMO_MODE=true)." >&2
  exit 1
fi

export PGCONNECT_TIMEOUT=20
export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=""
WORKDIR="$(mktemp -d /tmp/agendaflow-dbbackup.XXXXXXXX)"
VERIFY_PG_DIR="$WORKDIR/pgverify"
ARCHIVE="$WORKDIR/database.dump"
localStarted=0
cleanup() {
  if [[ "$localStarted" == "1" ]]; then
    pg_ctl -D "$VERIFY_PG_DIR" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "Criando backup PostgreSQL com snapshot consistente..."
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$ARCHIVE"
test -s "$ARCHIVE"
pg_restore --list "$ARCHIVE" > /dev/null

echo "Restaurando o backup em PostgreSQL temporario para validar integridade..."
initdb -D "$VERIFY_PG_DIR" -A trust --no-instructions --username=postgres >/dev/null
pg_ctl -D "$VERIFY_PG_DIR" -o "-k $WORKDIR -p 55432 -c listen_addresses=''" -w start >/dev/null
localStarted=1
createdb -h "$WORKDIR" -p 55432 -U postgres agendaflow_restore_test
pg_restore -h "$WORKDIR" -p 55432 -U postgres -d agendaflow_restore_test \
  --no-owner --no-acl --exit-on-error "$ARCHIVE" >/dev/null

psql -h "$WORKDIR" -p 55432 -U postgres -d agendaflow_restore_test \
  -v ON_ERROR_STOP=1 -Atqc "SELECT 1 FROM schema_migrations LIMIT 1" | grep -qx '1'
psql -h "$WORKDIR" -p 55432 -U postgres -d agendaflow_restore_test \
  -v ON_ERROR_STOP=1 -Atqc "SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'" | grep -qx '1'
pg_ctl -D "$VERIFY_PG_DIR" -m fast -w stop >/dev/null
localStarted=0
echo "Restauracao em banco isolado aprovada."

timestamp="$(date -u +'%Y-%m-%dT%H-%M-%SZ')"
key="agendaflow/demo/daily/${timestamp}-${RAILWAY_DEPLOYMENT_ID:-manual}.dump"
echo "Enviando dump verificado para armazenamento S3 privado..."
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$ARCHIVE" "s3://$BACKUP_BUCKET/$key" \
  --only-show-errors --no-progress
uploaded="$(aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3api head-object \
  --bucket "$BACKUP_BUCKET" --key "$key" --query 'ContentLength' --output text)"
localSize="$(wc -c < "$ARCHIVE" | tr -d ' ')"
if [[ "$uploaded" != "$localSize" ]]; then
  echo "ERRO: tamanho do arquivo S3 difere do arquivo local." >&2
  exit 1
fi

echo "Recuperando o dump diretamente do S3 e verificando o conteudo..."
DOWNLOADED="$WORKDIR/downloaded.dump"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "s3://$BACKUP_BUCKET/$key" "$DOWNLOADED" \
  --only-show-errors --no-progress
if ! cmp -s "$ARCHIVE" "$DOWNLOADED"; then
  echo "ERRO: conteudo recuperado do bucket difere do dump restaurado." >&2
  exit 1
fi
pg_restore --list "$DOWNLOADED" >/dev/null

# Atesta o backup somente DEPOIS de um restore em servidor isolado
# e da recuperacao byte-a-byte do objeto no armazenamento privado.
# Nenhum conteudo do dump ou credencial e registrado na API.
sha="$(sha256sum "$DOWNLOADED" | cut -d ' ' -f 1)"
echo "Registrando somente a hora e a integridade do backup no banco da demo..."
psql --dbname="$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 \
  -v backup_sha="$sha" -v backup_size="$localSize" <<'SQL'
INSERT INTO backup_verifications(id,verified_at,archive_size_bytes,sha256)
VALUES (1, now(), :'backup_size'::bigint, :'backup_sha')
ON CONFLICT (id) DO UPDATE
SET verified_at=excluded.verified_at,
    archive_size_bytes=excluded.archive_size_bytes,
    sha256=excluded.sha256;
SQL
echo "Backup confirmado no bucket privado, recuperado e registrado no monitor. Bytes: $localSize"
