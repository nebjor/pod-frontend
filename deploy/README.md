# Deployment and runbook

One Hetzner server (Ubuntu 24.04, x86) runs the whole shop with Docker Compose: Caddy
terminates HTTPS for `3dburg.ch`, the Angular SSR server and the Spring backend sit behind it,
PostgreSQL and the order files live on named volumes. Nothing but ports 80 and 443 is
published.

```
internet ──443──> caddy ──> pod-frontend:4000  (Angular SSR)
                        └─> slicer-engine:8080 (Spring, Bambu Studio CLI) ──> postgres:5432
                                                                     └─> order_files volume
```

## First deployment

1. **Server**: Ubuntu 24.04, a user with sudo, SSH keys only (`PasswordAuthentication no`).
   Install Docker from the official repository and add the user to the `docker` group:
   https://docs.docker.com/engine/install/ubuntu/ (what is in place is listed under
   "Server access and hardening" below).
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
6. **Start**: `docker compose up -d --build`. The first build
   downloads the Bambu Studio AppImage (230 MB) and verifies its SHA-256.
7. **Check**:
   ```bash
   curl -I http://3dburg.ch            # 308 to https
   curl -s https://3dburg.ch/api/orders/settings
   docker compose ps   # all "healthy"
   ```
   From another machine: `nmap -Pn 3dburg.ch` shows 22, 80 and 443 only.
8. **Backups**: `chmod +x backup.sh`, add the cron line from the top of the script, run it once
   by hand and then **rehearse a restore** (below) before taking the first order.

With the mock provider the payment page is a stand-in: orders become `PAID` without money.
Do not ship anything ordered through it.

## Switch payments to Stripe

Until this is done the mock provider is active and orders become `PAID` without money. Do it
first with the **test** keys and a test card, then once more with the live keys.

1. In the Stripe dashboard open **Entwickler → API-Schlüssel** and copy the secret key
   (`sk_test_...`, later `sk_live_...`).
2. Under **Entwickler → Webhooks** add an endpoint for
   `https://3dburg.ch/api/payments/stripe/webhook` with the events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then copy its
   signing secret (`whsec_...`). Test and live mode each have their own endpoint and secret.
3. On the server set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
   in `.env`, then `docker compose up -d slicer-engine`. The backend
   refuses to start if either key is missing; `logs slicer-engine` says which.
4. Place an order with Stripe's test card `4242 4242 4242 4242`, any future date, any CVC.
   The success page must switch to "bezahlt", the order must be `PAID` in `/admin`, and the
   webhook's delivery must show `200` in the Stripe dashboard. A `400` there means the secret
   in `.env` belongs to another endpoint.
5. Repeat steps 1 to 4 with the live keys and the live webhook endpoint. From then on the
   `/pay/mock` page and the mock confirmation endpoint no longer exist.

## Server access and hardening

Done on 2026-10-21, here so the next person knows the shape of the box.

- Log in as `joris` with an SSH key (`ssh 3dburg` from the owner's PC, alias in `~/.ssh/config`).
  The user has passwordless sudo and is in the `docker` group; `/opt/3dburg` belongs to it, and
  its `~/.ssh` holds the read-only GitHub deploy key for the backend repository.
- Root login and password login are off: `/etc/ssh/sshd_config.d/00-hardening.conf`. The
  file sorts first on purpose, sshd keeps the first value it reads.
- `fail2ban` bans addresses after repeated SSH failures (default `sshd` jail). If you lock
  yourself out from a new network, use the Hetzner console: `fail2ban-client set sshd unbanip <ip>`.
- `unattended-upgrades` installs security updates nightly. Kernels are not among them: when the
  login banner says "System restart required" or lists a `linux-image` update, run
  `sudo apt full-upgrade -y && sudo reboot` (about a minute of downtime, containers come back
  by themselves).
- `ufw` allows 22, 80 and 443 only. The nightly backup runs from root's crontab.
- Handy alias for the compose file: `alias dc="docker compose --project-directory /opt/3dburg/pod-frontend/deploy"`.

## Update

```bash
cd /opt/3dburg/pod-frontend && git pull
cd /opt/3dburg/cad-slicer-engine && git pull
cd /opt/3dburg/pod-frontend/deploy && docker compose up -d --build slicer-engine pod-frontend
```

Inside `deploy/` no `-f` is needed: the file has the default name `compose.yaml`. Name the
services to rebuild only those; a bare `up -d --build` rebuilds whatever changed anyway.
Database migrations run at backend start (Flyway). Images are rebuilt only for services whose
sources changed; the frontend takes about two minutes, the backend about four.

## Roll back

Check out the previous commit in the repository that broke and rebuild that service:

```bash
cd /opt/3dburg/cad-slicer-engine && git log --oneline -5 && git checkout <good-sha>
cd /opt/3dburg/pod-frontend/deploy && docker compose up -d --build slicer-engine
```

Flyway migrations are forward-only. If a release added a migration, restore the database from
the backup taken before the update instead of rolling the code back alone.

## Restore from backup

The dump is plain SQL without `DROP` statements, so it must go into an empty schema: restoring
over existing tables fails on "already exists" and silently skips rows. Rehearsed 2026-10-20
(1 order, 4 migrations, 1 order file restored identically).

```bash
cd /opt/3dburg/pod-frontend/deploy
STAMP=<stamp>   # e.g. 20261020-173535, from ls /var/backups/3dburg
PSQL="docker compose exec -T postgres psql -U sliceruser -d slicercore"

docker compose stop slicer-engine
$PSQL -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
gunzip -c /var/backups/3dburg/db-$STAMP.sql.gz | $PSQL -v ON_ERROR_STOP=1 -q && echo "DB RESTORED"
docker run --rm -v 3dburg_order_files:/data -v /var/backups/3dburg:/backup alpine:3.20   sh -c "rm -rf /data/* && tar xzf /backup/order-files-$STAMP.tar.gz -C /data"
docker compose start slicer-engine

# Verify: order count and file count must match the state the backup was taken from.
$PSQL -tAc 'select count(*) from orders'
docker run --rm -v 3dburg_order_files:/data:ro alpine:3.20 sh -c 'ls /data | wc -l'
```

If the restore fails half-way nothing is lost: the backup file is untouched and the backend
recreates an empty schema through Flyway on its next start, so fix the cause and run it again.

Restoring a backup that predates an erasure brings personal data back; run the retention sweep
afterwards (it runs nightly, or restart the backend and wait for the cron) and re-apply any
deletion requests made since.

## Rotate a credential

- **Admin password**: change `ADMIN_PASSWORD` in `.env`, `docker compose ... up -d slicer-engine`.
- **Database password**: `docker compose ... exec postgres psql -U sliceruser -d slicercore -c "ALTER USER sliceruser PASSWORD '<new>'"`,
  then update `.env` and `up -d slicer-engine postgres`.
- **Mail password**: change it in the Infomaniak manager, update `.env`, `up -d slicer-engine`.
- **Stripe keys**: roll the secret key or the webhook secret in the Stripe dashboard, update `.env`, `up -d slicer-engine`.

## Reset a rate limit

Log in at `https://admin.3dburg.ch` and use the reset button, or
`curl -u admin -X POST https://3dburg.ch/api/admin/rate-limits/reset`.

## Logs and disk

```bash
docker compose logs -f slicer-engine
docker system df                       # image and volume sizes
docker image prune -f                  # after a few updates
```

The order-files volume grows with uploads and shrinks when the nightly retention sweep erases
shipped orders (90 days after shipping).
