# PixelCode Arena: status against the SRS (v0.2)

Live: https://pixelcode-frontend.onrender.com (frontend) / backend on Render, PostgreSQL.

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
| US-17 Submit solution (server-side check) | Done | Rhino sandbox |
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
| US-36 Easy challenges only | Done | |

## Should (10)
US-03 Reset password: done (/forgot-password, /reset-password; e-mail needs SMTP, otherwise link in backend log).
US-04 Sign out: done (menu QUIT, Settings).
US-10 Cancel matchmaking: done.
US-23 Withdraw challenge: done (/admin).
US-26 Leaderboard: done. US-27 My position: done.
US-28 Browse skins, US-29 Equip, US-31 Buy: done (/store, server-side balance).
US-30 Publish cosmetic (admin): done (/admin: name, price, picture; appears in /store and in matches).

## Could / Won't
US-05 Language EN / KZ: done (Settings). US-06 Music volume: done. US-07 Fullscreen: done.
US-08 Close account: excluded by SRS (a delete-account action exists in the profile anyway).

## Open items
- Full end-to-end test in several browsers (NFR-08) and the 50-match load test (NFR-02/03) are not done.
- E-mail verification, refresh of old login tokens after password reset.
- Byte Knight skin art is a placeholder.
