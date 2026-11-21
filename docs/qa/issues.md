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
