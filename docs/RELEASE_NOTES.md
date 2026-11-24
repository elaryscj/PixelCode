# PixelCode Arena v0.9-beta

Beta release for the SOE 205 capstone defense. Code freeze: see README.

## Included
- **Core 1v1 race (all 22 Must stories):** sign-up / sign-in, Quick Play matchmaking by rating, versus screen, the same map for both players, live opponent position, four doors with Java challenges checked on the server, 4-minute auto-opening doors, server-decided finish, Elo rating applied once, 5-minute join and reconnect windows with bans and technical results.
- **All Should and Could stories:** password reset by e-mail, sign-out, cancel search, withdraw challenges, leaderboard with your position, store with animated pixel skins, admin skin editor, 14 languages, music and sound settings, fullscreen.
- **Beyond the SRS:** PIXEL_BOT when nobody else is queuing (gentler for a newcomer's first match), practice mode with real tasks, private rooms and invite links, seasons, quests, achievements, friends, duels, blocking, spectator mode, emotes and quick phrases, replays, best solutions, weekend tournament, teacher mode for classes, admin statistics, weekly encrypted database backup.

## Fixed since Week 10 testing
- I-01 username input stops at 16 characters in the register form.
- I-02 sign-in and recovery pages show the real server location.
- I-03 admin page fits phone screens.
- I-04 unknown addresses and malformed requests return 404 / 400 instead of 500.

## Tested
- 24 November 2026, production: API test run 29 passed, 0 failed, 6 skipped (timer and admin cases); see docs/qa/test-cases.md.

## Known limitations
- Free hosting: the backend sleeps after 15 minutes without visitors; the first request can take up to a minute.
- Only Java is supported for solutions.
- Performance targets NFR-01 – NFR-03 (100 visits, 50 concurrent matches) are not load-tested yet; NFR-06 usability test is planned.
- Edge and Firefox were not tested (Chrome, Safari and phones were).
- Online payment for the teacher subscription is switched off until the merchant account is approved.
- Servers are in Frankfurt (Germany); storing Kazakhstan users' personal data abroad needs a legal review before a public launch.
