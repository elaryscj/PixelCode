# Defects found in Week 10 (texts for GitHub Issues)

Labels to create once in GitHub (Issues -> Labels -> New label): `Critical` (red), `Major` (orange), `Minor` (yellow), `frontend`, `backend`, `auth`.
Each fix below is on branch `redesign-mobile`; its pull request description should contain `Closes #<issue number>`.

---

## I-01 — [Minor] Register form lets you type 20 characters in the username, but only 16 are allowed
Labels: `Minor`, `frontend`, `auth`

**Steps to reproduce**
1. Open /login, press Register.
2. Type a 20-character username, fill the other fields correctly, press REGISTER.

**Expected:** the field stops at 16 characters (the rule is 2-16).
**Actual:** 20 characters can be typed, then the form says "Username must be 2-16 characters".
**Screenshot:** register form with the error under the username.
**Fix:** in register mode the input's `maxLength` is `NICKNAME_MAX` (16); sign-in still accepts older 20-character names.

---

## I-02 — [Minor] Sign-in and password-recovery pages always say the server is in "KAZAKHSTAN"
Labels: `Minor`, `frontend`

**Steps to reproduce**
1. Sign out, open /login (or /forgot-password).
2. Look at the header next to PIXELCODE.

**Expected:** the real server location, like on the other pages ("SERVER: GERMANY (FRANKFURT)").
**Actual:** the text "KAZAKHSTAN" is hardcoded although the server runs in Frankfurt.
**Screenshot:** /login header.
**Fix:** both headers use `useServerLabel()` (backend `SERVER_REGION` via /api/health).

---

## I-03 — [Minor] Admin page is wider than a phone screen
Labels: `Minor`, `frontend`

**Steps to reproduce**
1. Sign in as an administrator on a phone (or a 375 px wide window).
2. Open /admin.

**Expected:** the page fits the screen, the statistics table scrolls inside its own box.
**Actual:** the whole page is 672 px wide and scrolls sideways; the title is cut.
**Screenshot:** /admin at 375 px.
**Fix:** the page container takes the full width (so the wide table no longer stretches it), the title size follows the screen width and the two-column form fields stack on phones.

---

## I-04 — [Minor] Backend answers 500 and logs a stack trace for unknown addresses and malformed requests
Labels: `Minor`, `backend`

Found in the Render deploy log after switching production to the `release` branch (Week 11 deployment check).

**Steps to reproduce**
1. Open https://pixelcode-api.onrender.com/ (Render's health check does this on every start), or send `POST /api/auth/login` with broken JSON, or `GET /api/solutions/abc`.

**Expected:** 404 (unknown address) or 400 (bad request), no error in the log.
**Actual:** 500 "Internal server error" and a long `NoResourceFoundException` stack trace in the log.
**Fix:** the error handler returns Spring's own 4xx status for client errors (404 / 400 / 405) and logs stack traces only for real server errors.

## Also fixed: frontend dependency warnings
`npm audit` reported 7 vulnerabilities in Express packages used only by the local preview server (the production site is static files, so players were not affected). `npm audit fix` updated them; `npm audit` now finds 0.

---

## I-05 — [Major] Data Stream: door 1 can be opened from the start position
Labels: `Major`, `backend`, `frontend`
Found 24 November 2026 by the production API run after v0.9.2-beta (TC-17 failed: "Open a door from far away" returned 200).

**Steps to reproduce**
1. Start a match on DATA STREAM (map 5).
2. Without moving, press E (or call `POST /api/games/{code}/doors/1/open` with the start position).

**Expected:** 409 "Walk up to the door first".
**Actual:** 200, the challenge opens: door 1 stood 8 units from the start, inside the server's 13-unit "at the door" range.
**Fix:** door 1 moved to x = 18 (maps.ts, maps.json, MapGeometry.java, QA script tables). Local rerun on map 5: TC-17 PASS.

