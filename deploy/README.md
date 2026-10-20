# Deployment and runbook

One Hetzner server (Ubuntu 24.04, x86) runs the whole shop with Docker Compose: Caddy
terminates HTTPS for `3dburg.ch`, the Angular SSR server and the Spring backend sit behind it,
PostgreSQL and the order files live on named volumes. Nothing but ports 80 and 443 is
published.

```
internet ──443──> caddy ──> frontend:4000 (Angular SSR)
                        └─> backend:8080  (Spring, Bambu Studio CLI) ──> postgres:5432
                                                                     └─> order_files volume
```

## First deployment

1. **Server**: Ubuntu 24.04, a user with sudo, SSH keys only (`PasswordAuthentication no`).
   Install Docker from the official repository and add the user to the `docker` group:
   https://docs.docker.com/engine/install/ubuntu/
2. **Firewall**: `ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`.
3. **DNS** at Infomaniak: `A` records for `3dburg.ch`, `www` and `admin` to the server's IPv4
   (and `AAAA` for IPv6 if the server has one). Caddy cannot get a certificate before this
   resolves. The admin panel is served on `admin.3dburg.ch` only; `/admin` on the shop host
   redirects there, so the owner's login never shares a browser session with a shop visit.
4. **Code**:
   ```bash
   sudo mkdir -p /opt/3dburg && sudo chown "$USER" /opt/3dburg && cd /opt/3dburg
   git clone https://github.com/nebjor/pod-frontend.git
   git clone https://github.com/nebjor/cad-slicer-engine.git
   ```
5. **Secrets**: `cd pod-frontend/deploy && cp .env.example .env && chmod 600 .env`, then fill
   `DB_PASSWORD`, `ADMIN_PASSWORD` (long random values, `openssl rand -base64 32`) and the mail
   account. Keep `PAYMENT_PROVIDER=mock` until the Stripe keys exist.
6. **Start**: `docker compose -f docker-compose.prod.yml up -d --build`. The first build
   downloads the Bambu Studio AppImage (230 MB) and verifies its SHA-256.
7. **Check**:
   ```bash
   curl -I http://3dburg.ch            # 308 to https
   curl -s https://3dburg.ch/api/orders/settings
   docker compose -f docker-compose.prod.yml ps   # all "healthy"
   ```
   From another machine: `nmap -Pn 3dburg.ch` shows 22, 80 and 443 only.
8. **Backups**: `chmod +x backup.sh`, add the cron line from the top of the script, run it once
   by hand and then **rehearse a restore** (below) before taking the first order.

With the mock provider the payment page is a stand-in: orders become `PAID` without money.
Do not ship anything ordered through it.

## Update

```bash
cd /opt/3dburg/pod-frontend && git pull
cd /opt/3dburg/cad-slicer-engine && git pull
cd /opt/3dburg/pod-frontend/deploy && docker compose -f docker-compose.prod.yml up -d --build
```

Database migrations run at backend start (Flyway). Images are rebuilt only for services whose
sources changed; the frontend takes about two minutes, the backend about four.

## Roll back

Check out the previous commit in the repository that broke and rebuild that service:

```bash
cd /opt/3dburg/cad-slicer-engine && git log --oneline -5 && git checkout <good-sha>
cd /opt/3dburg/pod-frontend/deploy && docker compose -f docker-compose.prod.yml up -d --build backend
```

Flyway migrations are forward-only. If a release added a migration, restore the database from
the backup taken before the update instead of rolling the code back alone.

## Restore from backup

```bash
cd /opt/3dburg/pod-frontend/deploy
docker compose -f docker-compose.prod.yml stop backend
gunzip -c /var/backups/3dburg/db-<stamp>.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T postgres psql -U sliceruser -d slicercore
docker run --rm -v 3dburg_order_files:/data -v /var/backups/3dburg:/backup alpine:3.20 \
  sh -c "rm -rf /data/* && tar xzf /backup/order-files-<stamp>.tar.gz -C /data"
docker compose -f docker-compose.prod.yml start backend
```

Restoring a backup that predates an erasure brings personal data back; run the retention sweep
afterwards (it runs nightly, or restart the backend and wait for the cron) and re-apply any
deletion requests made since.

## Rotate a credential

- **Admin password**: change `ADMIN_PASSWORD` in `.env`, `docker compose ... up -d backend`.
- **Database password**: `docker compose ... exec postgres psql -U sliceruser -d slicercore -c "ALTER USER sliceruser PASSWORD '<new>'"`,
  then update `.env` and `up -d backend postgres`.
- **Mail password**: change it in the Infomaniak manager, update `.env`, `up -d backend`.
- **Stripe keys** (once live): rotate in the Stripe dashboard, update `.env`, `up -d backend`.

## Reset a rate limit

Log in at `https://admin.3dburg.ch` and use the reset button, or
`curl -u admin -X POST https://3dburg.ch/api/admin/rate-limits/reset`.

## Logs and disk

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker system df                       # image and volume sizes
docker image prune -f                  # after a few updates
```

The order-files volume grows with uploads and shrinks when the nightly retention sweep erases
shipped orders (90 days after shipping).
