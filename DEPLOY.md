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
3. If your service URLs differ from `pixelcode-backend.onrender.com` / `pixelcode-frontend.onrender.com`,
   edit them in render.yaml (VITE_API_URL, VITE_WS_URL, FRONTEND_URL), push, and redeploy.
4. Optional e-mail: set MAIL_HOST / MAIL_USER / MAIL_PASSWORD in the backend service's Environment tab.
Free instances sleep after ~15 min idle (first open takes ~1 min).
