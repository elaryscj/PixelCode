# Deploy

Needs a Linux server with Docker (e.g. any VPS, 2 GB RAM).

```bash
cp .env.example .env     # fill DB_PASSWORD, TOKEN_SECRET, SITE_ADDRESS (domain) and ADMIN_USERNAMES
docker compose up -d --build
```

Open http://SERVER_IP (or https://your-domain). First start takes a few minutes (Maven build).
Logs: `docker compose logs -f backend`

## Local development
- Backend: needs PostgreSQL on localhost:5432 (db `game_db`, user `postgres`, password `root`), then `cd backend && ./mvnw spring-boot:run`
- Frontend: `cd frontend && npm install && npm run dev` (Vite proxies /api and /ws to :8080)

## Game rules (all enforced by the server)
- Door timer 4 min, starts on first open, never resets, opens the door automatically.
- 5 min to join an assigned match / 5 min to reconnect, otherwise ban (30 min, BAN_MINUTES) + technical loss.
- Elo K=32 rating, applied once. Match time limit 20 min (more doors wins, equal = draw).
- Admin API: POST /api/admin/challenges (needs a reference solution that passes all tests).

## Render (free, no server needed)
1. Push this folder to a GitHub repo.
2. render.com > New > Blueprint > choose the repo > Apply. Wait for both services to build.
3. If your service URLs differ from `pixelcode-backend.onrender.com` / `pixelcode-arena.onrender.com`,
   edit them in render.yaml (VITE_API_URL, VITE_WS_URL, FRONTEND_URL), push, and redeploy.
4. E-mail (password reset): Render's free plan blocks SMTP, so use Brevo (free, 300 e-mails a day): sign up at brevo.com, verify a sender address, create an API key, then set BREVO_API_KEY and MAIL_FROM (that sender address) in the backend service's Environment tab. On a paid plan MAIL_HOST / MAIL_USER / MAIL_PASSWORD (SMTP) also work.
5. Set SERVER_REGION (e.g. oregon) on the backend so players see where the server is.
Free instances sleep after ~15 min idle (first open takes ~1 min).
6. Online payment (Freedom Pay): in the Freedom Pay cabinet copy the Merchant ID and the payment secret key, set FREEDOM_MERCHANT_ID and FREEDOM_SECRET_KEY on the backend. Start with FREEDOM_TESTING=true (test cards from docs.freedompay.kz), then remove it. The result URL is sent with every payment (https://<backend>/api/payments/freedom/result), nothing to configure.

## Database backups (GitHub Actions, free)
`.github/workflows/db-backup.yml` dumps the Neon database every Monday 01:00 UTC and keeps the encrypted file for 90 days.
1. GitHub repo > Settings > Secrets and variables > Actions > New repository secret:
   `NEON_DATABASE_URL` = Neon > Connect > (Pooled connection OFF) `postgresql://...?sslmode=require`;
   `BACKUP_PASSPHRASE` = a long random phrase. Save the phrase somewhere outside GitHub too: without it a backup cannot be opened.
2. Actions > Database backup > Run workflow, to check it once. The file is under the run's "Artifacts".
3. GitHub pauses scheduled workflows after 60 days without commits: if that happens, press "Enable workflow" in Actions.

Restore (needs PostgreSQL 18 tools or Docker):
```bash
gpg --decrypt pixelcode-YYYY-MM-DD.dump.gpg > pixelcode.dump      # asks for BACKUP_PASSPHRASE
pg_restore --clean --if-exists --no-owner -d "postgresql://...target..." pixelcode.dump
```

## Problems found after deployment and how they were solved
| Problem | Cause | Fix |
| --- | --- | --- |
| Password-reset e-mails never arrived on Render | Render's free plan blocks outgoing SMTP ports | E-mail sent through Brevo's HTTPS API (`BREVO_API_KEY`, `MAIL_FROM`) |
| Opening any page except `/` directly gave "Not Found" | Static site has only `index.html` | Rewrite rule `/* -> /index.html` on the Render static site; frontend built in SPA mode |
| WebSocket connected locally but not online | `ws://` from an `https://` page and the allowed origin list | `VITE_WS_URL=wss://.../ws` and `CORS_ORIGINS` set to the site address |
| First request after a pause took about a minute | Free backend sleeps after 15 minutes | UptimeRobot pings `/api/health` every 5 minutes |
| Render's free PostgreSQL expires after 30 days | Free plan limit | Database moved to Neon (free, no expiry) through `DB_URL`; data copied with `pg_dump` / `pg_restore`, row counts checked |
| High ping for players in Kazakhstan | Server in Oregon (USA) | Backend recreated in Frankfurt; the header shows `SERVER_REGION` |
| Kazakh letters shown in a fallback font | The pixel font had only the Latin part | Cyrillic and Latin-extended font subsets loaded on demand |

## Environments
- **Production:** `main` branch -> https://pixelcode-arena.onrender.com + https://pixelcode-api.onrender.com, Neon database `pixelcode`.
- **Local / development:** `redesign-mobile` and feature branches run on the developer's machine with the local `game_db`; automated tests use a separate `pixelcode_test` database.
- A separate hosted staging environment is not set up yet (Week 11 gap): planned as a second Render service + a Neon branch database, deployed from the `staging` branch.
