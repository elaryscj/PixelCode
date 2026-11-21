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
| Staging site could not sign in (`/api/api/...`) | `VITE_API_URL` was given with `/api` at the end | The value is the backend origin only; the site adds `/api` |
| High ping for players in Kazakhstan | Server in Oregon (USA) | Backend recreated in Frankfurt; the header shows `SERVER_REGION` |
| Kazakh letters shown in a fallback font | The pixel font had only the Latin part | Cyrillic and Latin-extended font subsets loaded on demand |

## Check from another device
After deploying, the main flow was completed on a phone from an empty account (register, menu, practice with touch controls, a door challenge, friends): see the screenshots in [qa/test-cases.md](qa/test-cases.md#production-check-from-another-device-week-11).

## Environments (staging and production)
| Item | Staging | Production |
| --- | --- | --- |
| Purpose | Test changes safely | What the instructor and players see |
| Git branch Render deploys from | `main` (every merged pull request) | `release` (moved only to a tagged, tested version) |
| Site | https://pixelcode-staging.onrender.com | https://pixelcode-arena.onrender.com |
| Backend | https://https-dashboard-render-com-fbww.onrender.com (service `pixelcode-api-staging`) | https://pixelcode-api.onrender.com |
| Database | Neon branch `staging` (separate copy) | Neon branch `main` of project `pixelcode` |
| Secrets | own `TOKEN_SECRET`, own DB password, no payment keys | own values, never copied to staging |

### One-time setup (about 20 minutes)
1. **Release branch.** GitHub > Code > branch list > New branch `release` from `main`. Then on Render open `pixelcode-api` and `pixelcode-arena` > Settings > Build & Deploy > Branch: `release`. Production now changes only when `release` moves.
2. **Staging database.** Neon console > project `pixelcode` > Branches > Create branch `staging` (from `main`) > Connect: copy host, user and password.
3. **Staging backend.** Render > New > Web Service > this repo, branch `main`, Root Directory `backend`, Runtime Docker, plan Free, region Frankfurt, name `pixelcode-api-staging`. Environment: `DB_URL=jdbc:postgresql://<staging host>/neondb?sslmode=require`, `DB_USER`, `DB_PASSWORD` (from step 2), `TOKEN_SECRET` (new value: `openssl rand -hex 32`), `ADMIN_USERNAMES`, `FRONTEND_URL=https://pixelcode-staging.onrender.com`, `CORS_ORIGINS=https://pixelcode-staging.onrender.com`, `SERVER_REGION=frankfurt`. No Brevo or payment keys.
4. **Staging site.** Render > New > Static Site > this repo, branch `main`, Root Directory `frontend`, build `npm ci && npm run build`, publish `build/client`, name `pixelcode-staging`. Environment: `VITE_API_URL=https://<staging backend>.onrender.com` (no `/api` at the end: the site adds it), `VITE_WS_URL=wss://<staging backend>.onrender.com/ws`. Redirects/Rewrites: `/*` -> `/index.html` (Rewrite).
5. Do not add the staging backend to UptimeRobot: it may sleep (the free plan has 750 instance hours a month for all services together).

### Releasing a version to production
1. Merge pull requests into `main`; Render deploys them to staging. Run `python3 docs/qa/run_api_tests.py https://pixelcode-api-staging.onrender.com/api` and click through the main flow on the staging site.
2. GitHub > Releases > Draft a new release > tag `v0.9-beta` (next: `v1.0`) on `main`, paste the notes from `docs/RELEASE_NOTES.md`, Publish.
3. GitHub > Pull requests > New: base `release` <- compare `main` (the tagged commit) > Merge. Render deploys production.
4. Rollback: open a pull request into `release` from the previous tag (or on Render: the service > Events > the previous deploy > Rollback).

Local / development: feature branches run on the developer's machine with the local `game_db`; automated tests use the separate `pixelcode_test` database.
