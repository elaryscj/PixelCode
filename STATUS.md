# PixelCode Arena: status against the SRS (v0.2)

Live: https://pixelcode-arena.onrender.com (frontend, Frankfurt) / backend on Render, PostgreSQL.

## Must (22)
| Story | Status | Where |
| --- | --- | --- |
| US-01 Register (username, email, password + field errors) | Done | /login |
| US-02 Sign in | Done | /login |
| US-09 Matchmaking queue, ban notice | Done | /play |
| US-11 Versus screen (names, ratings) | Done | /play/:code (ranked "Match found") |
| US-12 Equivalent maps | Done | same map layout for both panels |
| US-13 Move / jump, locked door blocks | Done | game |
| US-14 Opponent progress | Done | right panel, server-confirmed |
| US-15 First finish ends match | Done | server decides |
| US-16 Open door challenge (E) | Done | game |
| US-17 Submit solution (server-side check) | Done | Java 21: javac + allowlist, separate locked-down JVM |
| US-18 Unlock on verified solution | Done | |
| US-19 Rejection feedback | Done | |
| US-20 Door timer (4 min, no reset) | Done | server time |
| US-21 Auto-open after 4 min | Done | |
| US-22 Add challenge (validated) | Done | /admin (needs ADMIN_USERNAMES) |
| US-24 Match result screen | Done | Victory / Defeat / Technical |
| US-25 Rating change, once | Done | Elo K=32 |
| US-32 Join window 5 min, time shown | Done | lobby / match found |
| US-33 Reconnect within 5 min | Done | returns to match, timers kept |
| US-34 Ban for absence | Done | BAN_MINUTES (30) |
| US-35 Technical loss / win once | Done | |
| US-36 Challenge difficulty | Changed | 42 built-in Java challenges (EASY / MEDIUM / HARD); doors get harder with the players' average MMR |

## Should (10)
US-03 Reset password: done (/forgot-password, /reset-password; e-mail needs SMTP, otherwise link in backend log).
US-04 Sign out: done (menu QUIT, Settings).
US-10 Cancel matchmaking: done.
Quick Play bot: nobody in the queue for 20 s -> a duel against PIXEL_BOT (no MMR change, +40 / +10 PIXELS; game.bot-after-seconds, 0 = off). The bot really plays the level: the server runs a Java copy of the player physics (BotPhysics) and searches key presses (BotPathfinder) for a route, so it jumps, rides lifts, waits for blinking blocks and avoids hazards. Maps for the server: backend resources/game/maps.json, regenerate with `npm run export-maps` after editing frontend game/maps.ts (MapGeometryTest checks it).
US-23 Withdraw challenge: done (/admin).
US-26 Leaderboard: done. US-27 My position: done.
US-28 Browse skins, US-29 Equip, US-31 Buy: done (/store, server-side balance).
US-30 Publish cosmetic (admin): done (/admin: name, price, picture; appears in /store and in matches).

## Could / Won't
US-05 Languages: 14 (en, kz, ru, es, fr, de, pt, id, zh, ja, ko, hi, ar, ur; Arabic / Urdu right-to-left). Texts of the 42 built-in challenges and the server's error / checker messages are translated too (the frontend sends Accept-Language; backend i18n/, resources/i18n/). Challenge titles, the admin page and challenges added by an admin stay English. US-06 Music volume: done. US-07 Fullscreen: done.
US-08 Close account: excluded by SRS (a delete-account action exists in the profile anyway).

## Skins (beyond the SRS)
- Every skin is a 32 x 16 pixel texture cut into body parts (head, body, arms, legs, hair/hat; layout in frontend game/skinRig.ts). Animations are built from it in the browser: idle, walk, jump, fall, think (at a door), win, lose. The opponent's animation is read from their movement.
- Emotes in a match: wave (key 1) and dance (key 2), also on-screen buttons on phones; the server relays them to the opponent (at most one every 1.5 s).
- Season prize skins: in the editor an admin can tick SEASON PRIZE. Such a skin is never sold; when the season ends, places 1-3 get it (the newest waiting prize is used). It is shown on /progress and above the leaderboard; winners see it in their store.
- The PROGRESS menu button shows how many quests / achievements / season places are new since the player last opened /progress.
- The 4 built-in skins are redrawn as textures in game/builtinSkins.ts (no image files).
- /admin has a pixel editor for store skins: pencil, eraser, fill, picker, mirror for left/right, undo, live preview of every animation, GIF download, texture PNG download/upload, editing a published skin. Older admin items that are a single picture still show (not animated).

## Friends and daily login (beyond the SRS)
- /friends: add by player name (asking someone who already asked you = accept), answer requests, cancel your own, remove friends. Friends show Online / In a match / Offline (online = used the game in the last 2 minutes).
- DUEL challenges an online friend: the challenger's private room opens (or their waiting one is reused) and the friend gets a pop-up invitation on any screen except inside a match (polled every 8 s, kept in server memory for 5 minutes).
- Emotes show a heart (wave) or notes (dance) over the head and play a short sound.
- Quick phrases in a match (Good luck! / GG / Rematch? / Nice! / Oops! / Wow!): keys 3-8, buttons under the arena, a 💬 menu on phones, also on the result screen; fixed choices, shown translated, one every 2 s, still allowed 3 minutes after the end.
- Friend profile /player/:id (friends and yourself only): rating, record, achievements, season badges, last 10 matches. Friend names in /friends link to it.
- Duel invitations and friend requests arrive instantly over the WebSocket on a private, unguessable channel (/topic/inbox/{HMAC of the user id}); polling every 30 s stays as a safety net.
- Match replays /replay/:code (only the two players): both runs side by side like in the match, play / pause / 1x-8x / scrubbing, door markers (filled = solved, hollow = timer), who led when and overtakes, per door time, attempts and "stuck here" (over 90 s), and the code of every submission. Recorded on the server during the match (positions every 150 ms, door events, up to 20 submissions per player and door); kept 14 days. Links on the result screen and in My results.
- Daily login streak: the first visit of each UTC day pays 20, 30, 40, 50, 60, 80, then 100 PIXELS per day in a row; a missed day restarts at day 1. Shown on /progress and as a pop-up.

## Progress (beyond the SRS)
- Invite link: a private room shows INVITE A FRIEND -> /join/CODE (sign-in first if needed, then straight into the room).
- Daily quests: 3 per player per UTC day, PIXELS paid on completion; count Quick Play (bot) and ranked matches, not private rooms.
- Achievements: 12, one-time PIXELS reward each (/progress).
- Seasons: one per calendar month (UTC). At the end the top 10 with at least 3 ranked matches get 1000/700/500/200 PIXELS and a badge; every rating moves halfway back to 1500. Shown on /progress and above the leaderboard.

## Open items
- Full end-to-end test in several browsers (NFR-08) and the 50-match load test (NFR-02/03) are not done.
- E-mail verification. (Old login tokens now stop working after a password change or reset.)
- Byte Knight skin art is a placeholder.

## Teacher mode (beyond the SRS)
- An admin ticks TEACHER for an account in /admin; that player sees TEACHER in the menu (/teacher).
- A teacher creates a lesson: title, map, four tasks from the catalog (one per door, filter by EASY / MEDIUM / HARD), length 5-180 min. The lesson page (/teacher/CODE) shows a big join code, START / END and a live table (every 3 s): per student and door solved (time) / working / stuck over 3 min / not reached, attempts, finish time, online dot. Clicking a student shows every solution they sent, with the code and the error.
- Students need no account: /lesson (also linked on the login page and in the menu as LESSON), code + name. They all run the same map with the same four tasks at the same time; a door opens only with an accepted solution (no 4-minute auto-open), the clock is the lesson's time. Their token is kept in the browser (rejoin after closing the tab). Up to 60 students per lesson; rate limits count each student separately (a class shares one school address).
