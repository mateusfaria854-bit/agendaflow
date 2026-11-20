#!/usr/bin/env python3
"""Inventário de retenção S3. Somente LEITURA; nenhuma exclusão é implementada."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import os
import re
import subprocess
from typing import Callable

PREFIX = "agendaflow/demo/daily/"
NAME = re.compile(r"^agendaflow/demo/daily/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[A-Za-z0-9-]+\.dump$")
MAX_OBJECTS = 10000
MAX_BACKUP_AGE = timedelta(hours=36)


@dataclass(frozen=True)
class Backup:
    key: str
    modified: datetime
    size: int


def parse_timestamp(raw: str) -> datetime:
    value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    if value.tzinfo is None:
        raise ValueError("Timestamp sem fuso horário")
    return value.astimezone(timezone.utc)


def inventory(
    bucket: str,
    endpoint: str,
    run: Callable[..., subprocess.CompletedProcess] = subprocess.run,
) -> list[dict]:
    """Lista somente objetos do prefixo fixo, paginando sem comandos de escrita."""
    token = None
    seen_tokens = set()
    objects: list[dict] = []
    while True:
        cmd = [
            "aws", "--endpoint-url", endpoint, "s3api", "list-objects-v2",
            "--bucket", bucket, "--prefix", PREFIX, "--max-keys", "1000",
            "--no-paginate", "--output", "json",
        ]
        if token:
            cmd.extend(["--continuation-token", token])
        result = run(cmd, check=True, text=True, capture_output=True)
        data = json.loads(result.stdout)
        page = data.get("Contents", [])
        if not isinstance(page, list):
            raise ValueError("Resposta de inventário inesperada")
        objects.extend(page)
        if len(objects) > MAX_OBJECTS:
            raise ValueError("Inventário grande demais para inspeção segura")
        if not data.get("IsTruncated", False):
            break
        token = data.get("NextContinuationToken")
        if not isinstance(token, str) or not token or token in seen_tokens:
            raise ValueError("Paginação incompleta: manutenção bloqueada")
        seen_tokens.add(token)
    return objects


def plan(
    objects: list[dict],
    now: datetime,
    retention_days: int = 30,
    keep_latest: int = 14,
) -> dict:
    """Calcula uma prévia conservadora. NÃO devolve instruções de remoção."""
    if not 30 <= retention_days <= 365:
        raise ValueError("Retenção mínima de 30 dias (máximo 365)")
    if not 14 <= keep_latest <= 365:
        raise ValueError("Devem ser protegidas pelo menos 14 cópias")
    if now.tzinfo is None:
        raise ValueError("Relógio sem fuso horário")
    now = now.astimezone(timezone.utc)
    known: list[Backup] = []
    unknown = 0
    seen = set()
    for item in objects:
        key = item.get("Key")
        if not isinstance(key, str) or not key.startswith(PREFIX):
            raise ValueError("Inventário retornou objeto fora do prefixo permitido")
        if key in seen:
            raise ValueError("Chave duplicada no inventário")
        seen.add(key)
        try:
            if not NAME.fullmatch(key):
                unknown += 1
                continue
            stamp = parse_timestamp(item["LastModified"])
            size = item["Size"]
            if type(size) is not int or size <= 0:
                unknown += 1
                continue
            known.append(Backup(key, stamp, size))
        except (KeyError, TypeError, ValueError):
            unknown += 1

    known.sort(key=lambda item: (item.modified, item.key), reverse=True)
    cutoff = now - timedelta(days=retention_days)
    reason = None
    if unknown:
        reason = "objetos_nao_reconhecidos"
    elif len(known) < keep_latest:
        reason = "menos_de_14_copias"
    elif not known or (now - known[0].modified) > MAX_BACKUP_AGE:
        reason = "copia_recente_ausente"
    elif known[0].modified > now + timedelta(minutes=5):
        reason = "relogio_inconsistente"
    candidates = [item for item in known[keep_latest:] if item.modified < cutoff]
    if reason:
        candidates = []
    return {
        "mode": "preview_only",
        "status": "blocked" if reason else "ok",
        "reason": reason,
        "retention_days": retention_days,
        "protected_newest": keep_latest,
        "objects_scanned": len(objects),
        "recognized_backups": len(known),
        "unrecognized_objects": unknown,
        "would_expire_count": len(candidates),
        "would_expire_bytes": sum(x.size for x in candidates),
        "deleted_count": 0,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Somente prévia da retenção do bucket S3")
    parser.add_argument("--retention-days", type=int, default=30)
    parser.add_argument("--keep-latest", type=int, default=14)
    parser.add_argument("--execute", action="store_true", help="Proibido: nenhuma exclusão é suportada")
    args = parser.parse_args(argv)
    if args.execute:
        parser.error("Exclusão desabilitada. Este utilitário é SOMENTE LEITURA.")
    if os.environ.get("DEMO_MODE") != "true":
        parser.error("DEMO_MODE=true é obrigatório")
    bucket = os.environ.get("BACKUP_BUCKET")
    endpoint = os.environ.get("BACKUP_S3_ENDPOINT")
    if not bucket or not endpoint:
        parser.error("BACKUP_BUCKET e BACKUP_S3_ENDPOINT são obrigatórios")
    try:
        result = plan(inventory(bucket, endpoint), datetime.now(timezone.utc),
                      args.retention_days, args.keep_latest)
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        # Não imprimir parâmetros da AWS, URL ou credenciais em erro.
        print(json.dumps({"mode": "preview_only", "status": "blocked",
                          "reason": "inventario_indisponivel", "deleted_count": 0}))
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0 if result["status"] == "ok" else 2


if __name__ == "__main__":
    raise SystemExit(main())
