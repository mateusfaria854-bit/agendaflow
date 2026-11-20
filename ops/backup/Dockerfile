FROM postgres:18-bookworm
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends awscli ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY ops/backup/backup.sh /usr/local/bin/agendaflow-backup
RUN chmod 0555 /usr/local/bin/agendaflow-backup
USER postgres
ENTRYPOINT ["/usr/local/bin/agendaflow-backup"]
