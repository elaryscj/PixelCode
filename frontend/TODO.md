# PixelCode — Frontend TODO (in order)
 
Scope: the room flow (create → join → lobby → start) is the only part the backend supports. Everything else waits.
 
---
 
## 0. Before you start (do in parallel)
 
- [ ] Send the backend dev the issues list at the bottom of this file. The unique-nickname bug will block your own testing, so send it first.
- [ ] Commit or sort out `backend/` — it's untracked on your frontend branch.
- [ ] Run the backend locally on `:8080` and confirm it builds. If it fails, remove the unused `org.aspectj.apache.bcel.Repository` import in `RoomRepository.java`.
## 1. Connect to the backend
 
- [ ] Add a dev proxy in `vite.config.ts`:
  ```ts
  server: { proxy: { "/api": "http://localhost:8080" } }
  ```
- [ ] Create one API module (e.g. `src/api/rooms.ts`) with the base URL in one place and these functions:
  - `createRoom()` → `POST /api/rooms`
  - `getRoom(code)` → `GET /api/rooms/{code}`
  - `joinRoom(code, nickname)` → `POST /api/rooms/{code}/join?nickname=X`
  - `startRoom(code)` → `POST /api/rooms/{code}/start`
- [ ] Add the `Room` type:
  ```ts
  type RoomStatus = "WAITING" | "READY" | "PLAYING" | "FINISHED";
  type Room = {
    id: number;
    code: string;
    roomStatus: RoomStatus;
    players: { id: number; nickname: string }[];
  };
  ```
  (Ignore the duplicated `status` field — use `roomStatus`.)
- [ ] Test each call once from the browser console or a throwaway button.
## 2. Nickname
 
- [ ] Add a nickname input (first visit, or in Settings).
- [ ] Save it in `localStorage`, same pattern as the language setting.
- [ ] Show it in `UserInfo.tsx` instead of `User123`.
- [ ] Block PLAY until a nickname is set.
## 3. `/play` page
 
- [ ] Add the route in `routes.ts` (fixes the PLAY button 404).
- [ ] **Create room**: `createRoom()` → `joinRoom(code, nickname)` → navigate to `/play/:code`.
- [ ] **Join room**: code input → `joinRoom(code, nickname)` → navigate to `/play/:code`.
- [ ] Show a generic error message on failure (backend only returns 500 for now).
## 4. `/play/:code` lobby page
 
- [ ] Add the route in `routes.ts`.
- [ ] Show the room code with a copy button.
- [ ] Show the player list (1–2 players) and the status.
- [ ] Poll `getRoom(code)` every 1–2 s. Clear the interval on unmount.
- [ ] Identify "you" by matching your stored nickname against `players`.
- [ ] Status `READY` → show **Start** button → `startRoom(code)`.
- [ ] Status `PLAYING` → navigate to the game screen.
- [ ] Optional: play `pixelcode_race_theme.mp3` in the lobby.
## 5. Game screen placeholder
 
- [ ] Add `/play/:code/game` (or similar) with a "Match started" placeholder. No backend game logic exists yet.
## 6. Leave alone for now
 
- Leaderboard, MMR, store, ping (`18 ms`) — no backend for any of it. Keep the hardcoded data.
- STORE button still 404s; optionally point it to a "Coming soon" page.
---
 
## Issues to raise with the backend dev
 
1. `Player.nickname` is `@Column(unique = true)` — reusing a nickname in a second game throws a 500.
2. Every error is a generic 500 (room not found, room full, wrong status). Need 404/409 with a message.
3. No way to tell a player which one they are — frontend has to match by nickname.
4. Anyone can call `start`; nobody can leave a room.
5. No WebSocket — frontend has to poll.
6. No CORS config — needed for production (dev works through the Vite proxy).
7. Unused import in `RoomRepository.java` may break the build.
8. Missing entirely: users/login, MMR, leaderboard, store, problems, code submission, winner logic (`FINISHED` is never set).
 
