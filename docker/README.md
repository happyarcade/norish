# Norish production deployment

This deployment is intended for a single always-on Linux host. It builds this checkout, keeps
PostgreSQL and Redis off the host network, runs Norish as a non-root user, and persists database,
Redis, and uploaded recipe media in named volumes.

## Prerequisites

- A current Docker Engine with Docker Compose v2
- A Linux account allowed to run Docker
- At least 4 GB RAM and sufficient storage for recipe media and backups
- A reverse proxy with TLS for access outside a trusted home network

## First deployment

1. Create the private environment file and generate secrets:

   ```bash
   cp docker/.env.production.example docker/.env.production
   chmod 600 docker/.env.production
   chmod 750 docker/scripts/*.sh
   openssl rand -hex 24
   openssl rand -base64 32
   ```

2. Put those generated values into `POSTGRES_PASSWORD` and `MASTER_KEY`. Set `PUID` and `PGID`
   from `id -u` and `id -g` so the app image uses the host account identity.

3. Set the public URL. With a reverse proxy, keep `NORISH_BIND_ADDRESS=127.0.0.1`, set
   `AUTH_URL=https://recipes.example.com`, and include the same origin in `TRUSTED_ORIGINS`.

4. Validate and start the stack:

   ```bash
   docker compose --env-file docker/.env.production \
     -f docker/docker-compose.production.yml config --quiet
   docker compose --env-file docker/.env.production \
     -f docker/docker-compose.production.yml up -d --build
   docker compose --env-file docker/.env.production \
     -f docker/docker-compose.production.yml ps
   curl --fail http://127.0.0.1:3000/api/health
   ```

The application applies Drizzle migrations before accepting HTTP traffic. PostgreSQL, Redis, and
Chrome are not published on the host network. The Norish health check waits up to 90 seconds for
startup migrations and workers.

## LAN and mobile access

For direct access only on a trusted LAN, set:

```dotenv
NORISH_BIND_ADDRESS=0.0.0.0
AUTH_URL=http://192.168.1.20:3000
TRUSTED_ORIGINS=http://192.168.1.20:3000
```

Use the server's real static LAN address. Allow TCP port 3000 through the host firewall only for
the local subnet. HTTPS is strongly recommended whenever traffic can leave that network.

## Reverse proxy

The proxy must preserve the original host and scheme and support WebSocket upgrades. A minimal
Caddy site is:

```caddyfile
recipes.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

For Nginx, proxy HTTP/1.1 and forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Upgrade`,
and `Connection`. Keep `AUTH_URL` and `TRUSTED_ORIGINS` aligned with the HTTPS origin.

## Backups

The backup script briefly stops the application so the database dump and media archive describe
the same point in time. PostgreSQL remains available to the script.

```bash
docker/scripts/backup.sh
BACKUP_ROOT=/mnt/backups/norish docker/scripts/backup.sh
```

Each backup contains a compressed PostgreSQL custom dump, uploaded media archive, manifest, and
SHA-256 checksums. Keep `docker/.env.production`, especially `MASTER_KEY`, in a separate protected
backup or password manager. Encrypted settings cannot be recovered without the original key.

A typical nightly systemd timer or cron entry can run:

```cron
15 2 * * * cd /srv/norish && BACKUP_ROOT=/mnt/backups/norish docker/scripts/backup.sh >> /var/log/norish-backup.log 2>&1
```

Test restore procedures periodically. Retention is deliberately left to the host's backup policy.

## Restore

Restore is intentionally guarded because it replaces the current database and uploads:

```bash
docker/scripts/restore.sh /mnt/backups/norish/norish-20261021T020000Z --yes
```

The script verifies checksums, stops Norish, restores both data sets, restarts the app, and waits
for it to become healthy. Use the same `MASTER_KEY` that was active when the backup was created.

## Upgrade and rollback

1. Run and verify a backup.
2. Record the current Git commit and `NORISH_TAG`.
3. Pull or check out the desired revision.
4. Set a distinct image tag, such as `NORISH_TAG=2026-10-21`.
5. Validate and rebuild:

   ```bash
   docker compose --env-file docker/.env.production \
     -f docker/docker-compose.production.yml config --quiet
   docker compose --env-file docker/.env.production \
     -f docker/docker-compose.production.yml up -d --build
   ```

6. Check `ps`, `/api/health`, and recent logs.

Database migrations run automatically and may not be backward compatible. A complete rollback is
therefore: check out the previous revision, restore the pre-upgrade backup, rebuild with the prior
tag, and verify health.

## Operations

```bash
# Follow application logs
docker compose --env-file docker/.env.production \
  -f docker/docker-compose.production.yml logs -f norish

# Restart only the app
docker compose --env-file docker/.env.production \
  -f docker/docker-compose.production.yml restart norish

# Stop containers without deleting persistent volumes
docker compose --env-file docker/.env.production \
  -f docker/docker-compose.production.yml down
```

Never add `-v` to `docker compose down` unless permanently deleting all Norish data. Pin
`POSTGRES_IMAGE`, `REDIS_IMAGE`, and `CHROME_IMAGE` deliberately rather than allowing unattended
major-version upgrades.
