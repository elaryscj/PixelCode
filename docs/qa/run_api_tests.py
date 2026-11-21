#!/usr/bin/env python3
"""
Week 10 manual test run, scripted against the REST API so it can be repeated (Week 13 reruns it on production).

Usage:  python3 docs/qa/run_api_tests.py http://localhost:8092/api [--short-timers]
--short-timers: the backend runs with door 20 s, absence 30 s, join window 20 s, ban 2 min, no bot
(see docs/qa/test-cases.md); without it the timer cases (TC-24, TC-27..TC-29) are skipped.
Results are written to docs/qa/results-<date>.json. Uses only the Python standard library.
"""
import json
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8092/api"
SHORT = "--short-timers" in sys.argv
HERE = Path(__file__).resolve().parent
CATALOG = {c["title"]: c for c in json.load(open(HERE.parents[1] / "backend/src/main/resources/challenges/catalog.json"))}
RUN = uuid.uuid4().hex[:5]
results = []

# door and exit positions of the six maps (backend MapGeometry.MAPS)
DOORS = {
    0: [(45, 22), (32, 41.5), (23, 61), (60, 80)], 1: [(44, 22), (34, 41.5), (60, 61), (30, 80)],
    2: [(52, 30), (18, 52), (82, 66), (64, 82)], 3: [(58, 22), (28, 41.5), (70, 61), (34, 80)],
    4: [(50, 22), (22, 41.5), (22, 61), (30, 80)], 5: [(52, 22), (28, 41.5), (62, 61), (32, 80)],
}
EXITS = {0: (75, 80, 22), 1: (76, 80, 22), 2: (16, 82, 20), 3: (74, 80, 24), 4: (76, 80, 22), 5: (76, 80, 22)}


def call(method, path, body=None, token=None, lang="en"):
    req = urllib.request.Request(BASE + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept-Language", lang)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read().decode() or "null"
            return r.status, json.loads(raw, strict=False)
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or "{}"
        try:
            return e.code, json.loads(raw, strict=False)
        except ValueError:
            return e.code, {"raw": raw[:200]}


def record(tc, story, title, steps, expected, actual, ok):
    results.append({"id": tc, "story": story, "title": title, "steps": steps, "expected": expected,
                    "actual": actual, "result": "PASS" if ok else "FAIL"})
    print(f"{'PASS' if ok else 'FAIL'}  {tc} {story} {title}: {actual}")


def skip(tc, story, title, why):
    results.append({"id": tc, "story": story, "title": title, "steps": "", "expected": "", "actual": why, "result": "SKIP"})
    print(f"SKIP  {tc} {story} {title}: {why}")


def register(name, password="Passw0rd!x"):
    st, b = call("POST", "/auth/register", {"username": name, "email": f"{name}@example.com", "password": password})
    return st, b


def user(prefix):
    st, b = register(f"{prefix}{RUN}")
    assert st == 200, b
    return b["token"], b["id"]


def keep_alive(token, code, stop):
    while not stop.is_set():
        call("GET", f"/games/{code}", token=token)
        stop.wait(3)


def matched_pair(prefix):
    """Two new players join Quick Play together and both enter the match."""
    ta, ida = user(prefix + "a")
    tb, idb = user(prefix + "b")
    call("POST", "/matchmaking/join", token=ta)
    call("POST", "/matchmaking/join", token=tb)
    code = None
    for _ in range(15):
        st, s = call("GET", "/matchmaking/status", token=ta)
        call("GET", "/matchmaking/status", token=tb)
        if s.get("state") == "MATCHED":
            code = s["roomCode"]
            break
        time.sleep(1)
    return ta, ida, tb, idb, code


def walk(token, code, cp, tx, ty, start, final_call):
    """Moves in small legal steps (the server limits speed) by reporting positions; final_call reports the last."""
    x, y = start
    while True:
        dx, dy = tx - x, ty - y
        if abs(dx) < 0.01 and abs(dy) < 0.01:
            break
        x += max(-25, min(25, dx))
        y += max(-60, min(35, dy))
        time.sleep(0.55)
        st, b = final_call(x, y)
        if st == 200:
            return st, b, (x, y)
    time.sleep(0.55)
    st, b = final_call(x, y)
    return st, b, (x, y)


def main():
    print("Target:", BASE, "| run", RUN, "| short timers" if SHORT else "")

    # ------------------------------------------------------------------ US-01 register
    name = f"qa{RUN}"
    st, b = register(name)
    record("TC-01", "US-01", "Register with valid data", f"POST /auth/register username={name}, valid e-mail, password Passw0rd!x",
           "200, account created, token returned", f"{st}, token={'yes' if b.get('token') else 'no'}", st == 200 and bool(b.get("token")))
    st, b = call("POST", "/auth/register", {"username": "", "email": "", "password": ""})
    record("TC-02", "US-01", "Register with empty fields", "Submit the form with all fields empty",
           "400, account not created, error names a field", f"{st}, {b.get('message')} (field={b.get('field')})", st == 400 and b.get("field"))
    st, b = call("POST", "/auth/register", {"username": name, "email": f"other{RUN}@example.com", "password": "Passw0rd!x"})
    record("TC-03", "US-01", "Register a duplicate username", f"Register {name} again with a different e-mail",
           "Refused (4xx) with a username error", f"{st}, {b.get('message')}", 400 <= st < 500)
    st, b = call("POST", "/auth/register", {"username": f"qb{RUN}", "email": "not-an-email", "password": "Passw0rd!x"})
    record("TC-04", "US-01", "Register with a wrong e-mail format", "E-mail = not-an-email",
           "400, e-mail field error", f"{st}, {b.get('message')} (field={b.get('field')})", st == 400)
    st, b = call("POST", "/auth/register", {"username": "x" * 300, "email": f"long{RUN}@example.com", "password": "Passw0rd!x"})
    record("TC-05", "US-01", "Register with a very long username (300 chars)", "Username of 300 letters",
           "400, username error, no server error", f"{st}, {b.get('message')}", st == 400)
    st, b = call("POST", "/auth/register", {"username": f"qc{RUN}", "email": f"qc{RUN}@example.com", "password": "1"})
    record("TC-06", "US-01", "Register with a too short password", "Password = 1",
           "400, password error", f"{st}, {b.get('message')} (field={b.get('field')})", st == 400)

    # ------------------------------------------------------------------ US-02 sign in
    st, b = call("POST", "/auth/login", {"username": name, "password": "Passw0rd!x"})
    token = b.get("token")
    record("TC-07", "US-02", "Sign in with valid credentials", "POST /auth/login with the account from TC-01",
           "200, session token", f"{st}, token={'yes' if token else 'no'}", st == 200 and bool(token))
    st1, b1 = call("POST", "/auth/login", {"username": name, "password": "WrongPass1!"})
    st2, b2 = call("POST", "/auth/login", {"username": f"nobody{RUN}", "password": "WrongPass1!"})
    record("TC-08", "US-02", "Sign in with a wrong password / unknown user", "Wrong password; then a user that does not exist",
           "Both refused with the same generic message", f"{st1} '{b1.get('message')}' / {st2} '{b2.get('message')}'",
           st1 == st2 and st1 in (400, 401) and b1.get("message") == b2.get("message"))
    st, b = call("GET", "/friends")
    st2, _ = call("GET", "/profile/me")
    record("TC-09", "NFR-04", "Protected data without signing in", "GET /friends with no token",
           "401, no data", f"{st}, {b.get('message')}", st == 401)

    # ------------------------------------------------------------------ US-09/10 queue
    st, b = call("POST", "/matchmaking/join", token=token)
    record("TC-10", "US-09", "Enter matchmaking", "Signed in, press Play (POST /matchmaking/join)",
           "State SEARCHING", f"{st}, {b.get('state')}", st == 200 and b.get("state") == "SEARCHING")
    st, b = call("POST", "/matchmaking/cancel", token=token)
    record("TC-11", "US-10", "Cancel matchmaking", "While searching, press Cancel",
           "State IDLE, player left the queue", f"{st}, {b.get('state')}", st == 200 and b.get("state") == "IDLE")
    st, b = call("POST", "/matchmaking/join")
    record("TC-12", "US-09", "Enter matchmaking while logged out", "POST /matchmaking/join without a token",
           "401", f"{st}, {b.get('message')}", st == 401)

    # ------------------------------------------------------------------ match A vs B
    ta, ida, tb, idb, code = matched_pair("qm")
    st, room = call("GET", f"/rooms/{code}", token=ta) if code else (0, {})
    names = [p.get("nickname") for p in room.get("players", [])]
    record("TC-13", "US-11", "Versus information after pairing", "Two players with equal rating press Play at the same time",
           "Matched; room shows both usernames and ratings", f"code={code}, players={names}, ratings={[p.get('rating', p.get('ratingBefore')) for p in room.get('players', [])]}",
           bool(code) and len(names) == 2)
    if not code:
        print("No match: stopping")
        return
    record("TC-14", "US-32", "Time left to join is shown", "Open the assigned match (GET /rooms/{code})",
           "Response has the join deadline", f"keys={[k for k in room if 'join' in k.lower() or 'deadline' in k.lower() or 'assigned' in k.lower()]}",
           any("join" in k.lower() or "deadline" in k.lower() or "assigned" in k.lower() for k in room))
    call("POST", f"/rooms/{code}/ready", token=ta)
    call("POST", f"/rooms/{code}/ready", token=tb)
    time.sleep(1.5)
    st, sa = call("GET", f"/games/{code}", token=ta)
    st, sb = call("GET", f"/games/{code}", token=tb)
    record("TC-15", "US-12", "Both players get the same map", "Both enter; compare the map of each player's state",
           "Same mapId and door titles for both", f"A map {sa.get('mapId')}, B map {sb.get('mapId')}, same doors={sa.get('doorTitles') == sb.get('doorTitles')}",
           sa.get("mapId") == sb.get("mapId") and sa.get("doorTitles") == sb.get("doorTitles"))
    stop = threading.Event()
    threading.Thread(target=keep_alive, args=(tb, code, stop), daemon=True).start()
    mp = sa["mapId"]
    pos = (sa["me"]["x"], sa["me"]["y"])

    st, b = call("POST", f"/games/{code}/finish", {"x": pos[0], "y": pos[1]}, token=ta)
    record("TC-16", "US-13", "Locked doors block the way to the finish", "Claim the finish with all doors still locked",
           "409, 'Unlock all doors before reaching the exit'", f"{st}, {b.get('message')}", st == 409)
    st, b = call("POST", f"/games/{code}/doors/1/open", {"x": pos[0], "y": pos[1]}, token=ta)
    record("TC-17", "US-16", "Open a door from far away", "Press E at the start, far from door 1",
           "409, 'Walk up to the door first'", f"{st}, {b.get('message')}", st == 409)
    st, b = call("POST", f"/games/{code}/doors/2/open", {"x": pos[0], "y": pos[1]}, token=ta)
    record("TC-18", "US-16", "Skip a door", "Try to open door 2 before door 1",
           "409, 'Open the previous door first'", f"{st}, {b.get('message')}", st == 409)
    st, b = call("POST", f"/games/{code}/doors/1/open", {"x": 99, "y": 99}, token=ta)
    st2, s2 = call("GET", f"/games/{code}", token=ta)
    record("TC-19", "US-14", "Teleport is refused (server-confirmed position)", "Report a position across the map in one step",
           "Position not accepted", f"{st}; position after = ({s2['me']['x']}, {s2['me']['y']})", (s2["me"]["x"], s2["me"]["y"]) == pos)

    # walk to door 1 and open it
    dx, dy = DOORS[mp][0]
    target = (dx + 0.25, dy)
    st, ch, pos = walk(ta, code, 1, *target, pos, lambda x, y: call("POST", f"/games/{code}/doors/1/open", {"x": x, "y": y}, token=ta))
    record("TC-20", "US-16", "Open door 1 at the door", "Walk to door 1, press E",
           "Challenge with statement, input/output, starter code; door timer running",
           f"{st}, title={ch.get('title')}, timer={ch.get('secondsRemaining')}s", st == 200 and ch.get("description") and ch.get("secondsRemaining", 0) > 0)
    st, sb = call("GET", f"/games/{code}", token=tb)
    opp = sb.get("opponent") or {}
    record("TC-21", "US-14", "Opponent sees my progress", "After walking, B reads the match state",
           "B's opponent position = A's latest accepted position", f"B sees A at ({opp.get('x')}, {opp.get('y')}), A is at {pos}",
           abs(opp.get("x", -1) - pos[0]) < 0.01 and abs(opp.get("y", -1) - pos[1]) < 0.01)

    st, b = call("POST", f"/games/{code}/doors/1/submit", {"code": ""}, token=ta)
    record("TC-22", "US-17", "Submit empty code", "Press Submit with an empty editor",
           "400, 'Write some code first'", f"{st}, {b.get('message')}", st == 400)
    time.sleep(1.1)
    st, b = call("POST", f"/games/{code}/doors/1/submit", {"code": ch["initialCode"]}, token=ta)
    left1 = b.get("secondsRemaining")
    record("TC-23", "US-19", "Submit a wrong solution", "Submit the unchanged starter code",
           "passed=false, door stays locked, feedback shown", f"{st}, passed={b.get('passed')}, unlocked={b.get('unlocked')}, {b.get('passedCount')}/{b.get('total')} tests, error={b.get('errorMessage')}",
           st == 200 and not b.get("passed") and not b.get("unlocked"))
    time.sleep(2.1)
    st, b = call("POST", f"/games/{code}/doors/1/submit", {"code": "class Solution { public static int " + ch["functionName"] + "(int n) { while (true) {} } }"}, token=ta)
    left2 = b.get("secondsRemaining")
    record("TC-24", "US-20", "Countdown does not reset on resubmit", "Submit again (an endless loop) and compare the timer",
           "Time left keeps going down; endless loop stopped with a time-limit or type error", f"{left1}s -> {left2}s, error={b.get('errorMessage')}",
           left1 is not None and left2 is not None and left2 <= left1 and not b.get("passed"))
    time.sleep(1.1)
    ref = CATALOG.get(ch["title"], {}).get("referenceSolution")
    st, b = call("POST", f"/games/{code}/doors/1/submit", {"code": ref or ""}, token=ta)
    record("TC-25", "US-18", "Submit a correct solution", "Submit the catalog's reference solution",
           "passed=true, door 1 unlocked", f"{st}, passed={b.get('passed')}, unlocked={b.get('unlocked')}",
           st == 200 and b.get("passed") and b.get("unlocked"))

    # door 2 by the timer (short timers only), doors 3-4 solved
    for cp in (2, 3, 4):
        dx, dy = DOORS[mp][cp - 1]
        st, ch, pos = walk(ta, code, cp, dx + 0.25, dy, pos, lambda x, y, cp=cp: call("POST", f"/games/{code}/doors/{cp}/open", {"x": x, "y": y}, token=ta))
        if st != 200:
            record(f"TC-2x", "US-16", f"Reach door {cp}", "walk", "200", f"{st} {ch}", False)
            break
        if cp == 2 and SHORT:
            time.sleep(ch["secondsRemaining"] + 2.5)
            st, s = call("GET", f"/games/{code}", token=ta)
            record("TC-26", "US-21", "Door opens by itself when the timer ends", "Open door 2 and wait without submitting (door time 20 s in this run)",
                   "Door 2 unlocked for this player only", f"A unlocked={s['me']['unlocked']}, B unlocked={s['opponent']['unlocked']}",
                   2 in s["me"]["unlocked"] and 2 not in s["opponent"]["unlocked"])
            continue
        time.sleep(1.1)
        call("POST", f"/games/{code}/doors/{cp}/submit", {"code": CATALOG.get(ch["title"], {}).get("referenceSolution", "")}, token=ta)
    if not SHORT:
        skip("TC-26", "US-21", "Door opens by itself when the timer ends", "needs --short-timers (otherwise 4 minutes)")

    st, s = call("GET", f"/games/{code}", token=ta)
    before = {p: call("GET", "/auth/me", token=t)[1] for p, t in (("a", ta), ("b", tb))}
    ex, ey, ew = EXITS[mp]
    st, b, pos = walk(ta, code, 0, ex + ew / 2 - 3, ey, pos, lambda x, y: call("POST", f"/games/{code}/finish", {"x": x, "y": y}, token=ta))
    res = b.get("result") or {}
    record("TC-27", "US-15", "Finish the race", "All doors open, walk into the exit",
           "Match FINISHED, A is the winner", f"{st}, status={b.get('status')}, winner={res.get('winnerUserId')} (A={ida})",
           st == 200 and res.get("winnerUserId") == ida)
    st2, b2 = call("POST", f"/games/{code}/finish", {"x": pos[0], "y": pos[1]}, token=ta)
    st3, sbfin = call("GET", f"/games/{code}", token=tb)
    players = {p["userId"]: p for p in (res.get("players") or [])}
    pa, pb = players.get(ida, {}), players.get(idb, {})
    record("TC-28", "US-24", "Both players see the result", "B opens the match after A finished",
           "B sees FINISHED, LOSS for B, normal finish", f"B status={sbfin.get('status')}, B result={pb.get('result')}, reason={res.get('reason')}",
           sbfin.get("status") == "FINISHED" and pb.get("result") == "LOSS")
    after_a = call("GET", "/auth/me", token=ta)[1]
    record("TC-29", "US-25", "Rating changes once", "Read A's rating, then send the finish again",
           "Change shown (+ for A, - for B); a repeated finish does not change it again",
           f"A delta {pa.get('delta', pa.get('ratingDelta'))}, B delta {pb.get('delta', pb.get('ratingDelta'))}; repeat finish {st2}, rating after repeat {after_a.get('rating')}",
           (pa.get("delta", pa.get("ratingDelta")) or 0) > 0 and (pb.get("delta", pb.get("ratingDelta")) or 0) < 0 and st2 == 200)
    stop.set()

    # ------------------------------------------------------------------ absence: no-show, disconnect, ban
    if SHORT:
        ta2, ida2, tb2, idb2, code2 = matched_pair("qn")
        call("POST", f"/rooms/{code2}/ready", token=ta2)
        time.sleep(24)
        st, r2 = call("GET", f"/rooms/{code2}", token=ta2)
        st, q = call("POST", "/matchmaking/join", token=tb2)
        record("TC-30", "US-34", "No-show is banned", "B is matched but never enters (join window 20 s in this run)",
               "Match ends as NO_SHOW, A wins, B is banned and cannot queue", f"room={r2.get('roomStatus')}, B queue: {st} {q.get('message')}",
               st in (403, 409, 423) or "ban" in str(q.get("message", "")).lower())

        ta3, ida3, tb3, idb3, code3 = matched_pair("qd")
        call("POST", f"/rooms/{code3}/ready", token=ta3)
        call("POST", f"/rooms/{code3}/ready", token=tb3)
        time.sleep(2)
        st, s3 = call("GET", f"/games/{code3}", token=tb3)  # B present once, then "disconnects"
        time.sleep(12)
        st, s3b = call("GET", f"/games/{code3}", token=tb3)  # back before the deadline
        record("TC-31", "US-33", "Reconnect before the deadline", "B stops for 12 s (limit 30 s), then reopens the match",
               "Match still PLAYING, B's state restored, no penalty", f"status={s3b.get('status')}, map={s3b.get('mapId')}",
               s3b.get("status") == "PLAYING")
        stop3 = threading.Event()
        threading.Thread(target=keep_alive, args=(ta3, code3, stop3), daemon=True).start()
        time.sleep(36)
        st, s3c = call("GET", f"/games/{code3}", token=ta3)
        r = s3c.get("result") or {}
        stop3.set()
        record("TC-32", "US-35", "Disconnect too long = technical loss", "B stays away longer than 30 s",
               "Match ends once with reason ABSENCE, A wins", f"status={s3c.get('status')}, reason={r.get('reason')}, winner={r.get('winnerUserId')} (A={ida3})",
               s3c.get("status") == "FINISHED" and r.get("reason") == "ABSENCE" and r.get("winnerUserId") == ida3)
    else:
        for tc, sid, t in (("TC-30", "US-34", "No-show is banned"), ("TC-31", "US-33", "Reconnect before the deadline"),
                           ("TC-32", "US-35", "Disconnect too long = technical loss")):
            skip(tc, sid, t, "needs --short-timers")

    # ------------------------------------------------------------------ admin
    st, adm = register(f"qa_admin")
    if st != 200:
        st, adm = call("POST", "/auth/login", {"username": "qa_admin", "password": "Passw0rd!x"})
    tadm = adm.get("token")
    good = {"title": f"QA SUM {RUN}", "description": "Return a + b", "functionName": "solve", "difficulty": "EASY",
            "testsJson": '[{"input":[1,2],"expected":3},{"input":[0,0],"expected":0}]', "examples": "solve(1, 2) -> 3",
            "referenceSolution": "class Solution { public static int solve(int a, int b) { return a + b; } }"}
    st, b = call("POST", "/admin/challenges", good, token=tadm)
    record("TC-33", "US-22", "Admin adds a valid challenge", "Admin submits a challenge whose reference solution passes",
           "Published", f"{st}, published={b.get('published')}", st == 200 and b.get("published"))
    bad = dict(good, title=f"QA BAD {RUN}", testsJson="")
    st, b = call("POST", "/admin/challenges", bad, token=tadm)
    record("TC-34", "US-22", "Admin adds a challenge without tests", "Same form with empty tests",
           "Blocked with a specific error", f"{st}, {b.get('message')} (field={b.get('field')})", st == 400)
    st, b = call("POST", "/admin/challenges", good, token=ta)
    record("TC-35", "US-22", "A player tries the admin API", "Normal player POSTs a challenge",
           "403", f"{st}, {b.get('message')}", st == 403)

    out = HERE / f"results-{datetime.now():%Y-%m-%d}-{'local' if 'localhost' in BASE else 'prod'}.json"
    out.write_text(json.dumps({"target": BASE, "run": RUN, "at": datetime.now().isoformat(timespec="seconds"),
                               "results": results}, indent=1, ensure_ascii=False))
    passed = sum(r["result"] == "PASS" for r in results)
    print(f"\n{passed}/{len(results)} passed -> {out}")


if __name__ == "__main__":
    main()
