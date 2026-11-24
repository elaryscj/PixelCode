# PixelCode Arena release notes

## v0.9.1-beta (24 November 2026)

Released after the code freeze (23 November) as an exception: the arena looked unfinished next to other 2D games, and players could jump up through the floors. Tested on staging and production before the tag.

### Changed
- **Solid floors.** Fixed platforms are solid blocks: you bump your head on the underside and the sides stop you. Lifts, blinking and crumbling blocks stay one-way. Same rules in the browser (physics.ts) and in the bot's server copy (BotPhysics.java).
- **All six maps rebuilt** for solid floors: four floors 24 apart (enough room to jump spikes under a ceiling); the way up is a gap in the floor above with a step, a lift or a bounce pad. Themes kept (acid pillars, ice and icicles, lifts and belts, moving blocks, phase blocks). Door and exit positions changed (server MapGeometry and the QA script updated).
- **New look of the arena:** steel block platforms, a layered background per map (city, factory or server hall), steel spikes, numbered door plates, a light beam over the exit once all doors are open.
- **Dust** when jumping and landing.
- **Bigger arena, less on screen:** the duel and practice arenas fill the screen; name and rating appear once, no site navigation over the match, one quiet row of emotes and phrases, practice stats on the arena, key hints that fade.
- Footer shows the real version (was a hard-coded "v1.0-beta").

### Fixed
- Piston Works: the F2 lift no longer passes through a player standing under it (open shaft under the lift); Data Stream blinking steps no longer touch a standing player's head.
- Bot route planning skips falls to lower floors: about twice as fast as before.

### Tested
- Backend tests: 55 passed (the bot finds a route through every map from three start times).
- 24 November 2026, production, after the deploy: API test run 29 passed, 0 failed, 6 skipped (timer and admin cases); `docs/qa/results-2026-11-24-prod-v0.9.1.json`.

### Known limitations
- Replays of matches played before this version are drawn on the new maps (positions do not match the new walls). Replays are kept 14 days.
- Everything listed under v0.9-beta below.

## v0.9-beta (24 November 2026)
Beta release for the SOE 205 capstone defense. Code freeze: see README.

### Included
- **Core 1v1 race (all 22 Must stories):** sign-up / sign-in, Quick Play matchmaking by rating, versus screen, the same map for both players, live opponent position, four doors with Java challenges checked on the server, 4-minute auto-opening doors, server-decided finish, Elo rating applied once, 5-minute join and reconnect windows with bans and technical results.
- **All Should and Could stories:** password reset by e-mail, sign-out, cancel search, withdraw challenges, leaderboard with your position, store with animated pixel skins, admin skin editor, 14 languages, music and sound settings, fullscreen.
- **Beyond the SRS:** PIXEL_BOT when nobody else is queuing (gentler for a newcomer's first match), practice mode with real tasks, private rooms and invite links, seasons, quests, achievements, friends, duels, blocking, spectator mode, emotes and quick phrases, replays, best solutions, weekend tournament, teacher mode for classes, admin statistics, weekly encrypted database backup.

### Fixed since Week 10 testing
- I-01 username input stops at 16 characters in the register form.
- I-02 sign-in and recovery pages show the real server location.
- I-03 admin page fits phone screens.
- I-04 unknown addresses and malformed requests return 404 / 400 instead of 500.

### Tested
- 24 November 2026, production: API test run 29 passed, 0 failed, 6 skipped (timer and admin cases); see docs/qa/test-cases.md.

### Known limitations
- Free hosting: the backend sleeps after 15 minutes without visitors; the first request can take up to a minute.
- Only Java is supported for solutions.
- Performance targets NFR-01 – NFR-03 (100 visits, 50 concurrent matches) are not load-tested yet; NFR-06 usability test is planned.
- Edge and Firefox were not tested (Chrome, Safari and phones were).
- Online payment for the teacher subscription is switched off until the merchant account is approved.
- Servers are in Frankfurt (Germany); storing Kazakhstan users' personal data abroad needs a legal review before a public launch.
