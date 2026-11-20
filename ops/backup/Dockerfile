FROM postgres:18-bookworm
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends awscli python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY ops/backup/backup.sh /usr/local/bin/agendaflow-backup
COPY ops/backup/retention.py /usr/local/bin/agendaflow-retention-preview.py
RUN chmod 0555 /usr/local/bin/agendaflow-backup /usr/local/bin/agendaflow-retention-preview.py
USER postgres
ENTRYPOINT ["/usr/local/bin/agendaflow-backup"]
