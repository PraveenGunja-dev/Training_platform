Issues in Plain English

  🚨 The 2 Tests That Just Started Failing

  REG-1 — Attendance window check is gone
  The app used to stop you from starting attendance for a class that hasn't happened yet. Now it lets you. Tomorrow's class? You can mark people present today.

  REG-2 — Demo logins in the docs are dead (issue fixed))
  The instructions say "log in as asha@org.com". That user doesn't exist anymore. Someone renamed everyone to real names (kiran.nair@adani.com etc.) but forgot to update the docs.

---

  🔴 CRITICAL (don't ship until fixed)

  C-1 — Anyone on the internet can read your secrets (isse fixed)
  I downloaded your .env file (containing the SECRET_KEY and database password) without logging in. There's a download URL that doesn't check where the file lives — you can ask for ../../.env and it hands it over.

  C-2 — "Forgot password" doesn't work at all(isse fixed)
  Click "forgot password", get the email, click the link, set a new password → error every time. The reset email goes out, but the code that checks the token is looking for a record that was never created.

  C-3 — (issue fixed))Students THINK they uploaded their homework. They didn't.
  The progress bar is fake — it just counts to 100% in 2 seconds, then tells the server "I'm done". The actual file is never sent anywhere. Teachers see a submission in the list, click download, get nothing.

  C-4 — The production build is broken(issue fixed)
  npm run build doesn't work right now. You literally cannot ship the frontend. Three different type errors are blocking it.

  C-5 — Even if uploads worked, the server would reject them(issue fixed))
  The frontend says "here's my file under name X". The server says "I wanted name Y". They've drifted apart. Every submission would fail with a 400 error.

  C-6 — Users can't change their password from settings(issue fixed)
  Same problem as C-5. Frontend sends current + new. Backend expects current_password + new_password. Always fails.

  C-7 — Same as REG-1, re-stated as critical
  Admin can start attendance for next week's class today. Tested live, works.

  C-8 — Hidden "become admin" cheat code in the live site(issue fixed))
  There's a mockLogin('ADMIN') function left in the production code. Open the browser console, type one line, the UI thinks you're an admin. API calls still fail (the token is fake), but you can see everything
  cached in the browser.

---

  🟠 HIGH (fix this week)

  H-1 — Manager's attendance page doesn't work(isse fixed)
  The page asks the server for data using a URL that doesn't exist. Always 404.

  H-2 — "Ongoing classes" filter shows classes that ended 3 days ago
  The status field in the DB never updates. You filter for "live now" and get stale data.

  H-3 — "Load more" in audit log breaks(issue_fixed)
  The "next page" link is broken — it sends back an entire URL where a small token should be. Server gets confused, returns nothing.

  H-4 — Logout doesn't actually log you out (server-side)(issue_fixed)
  When you change your password or "force logout everywhere", the old session tokens are still valid until they naturally expire (could be days). Anyone who copied your token can keep using it.

  H-5 — Logout doesn't actually log you out (browser-side either)(issue_fixed)
  The browser just forgets you locally. The cookie that lets the server re-issue tokens is still there. On a shared computer, the next person clicks the site and you're still logged in.

  H-6 — When session refresh fails, the app silently breaks(issue_fixed)
  Instead of showing "logged out" properly, the request silently returns nothing. The page crashes trying to read data that isn't there.

  H-7 — Notification bell counter never updates after approve/reject(issue_fixed)
  The code tells React Query to refresh "notifications-unread-count" but the bell is listening for "notifications/unread-count". Different names. Refresh never happens.

  H-8 — "Forgot password?" link on login page goes nowhere(isse fixed)
  It's `<a href="#">`. Clicks it, page doesn't move. Plus the feature itself is broken (C-2). Combined, users have zero way to reset a password.

  H-9 — Any admin can edit any other admin's attendance records
  No permission check. Admin in Group A can flip attendance for students in Group B.

  H-10 — Anyone can get an upload link for any assignment
  The "give me a URL to upload to" endpoint doesn't check if you're allowed. Random students can mint upload links for assignments they shouldn't see.

  H-11 — "Added to group" notification spams duplicates
  The de-duplication key has a random string in it, so nothing ever matches. Re-adding the same person sends the same notification again.

  H-12 — Document list page makes ~2,000 database queries
  For 1,000 documents, the server runs 2 queries per document. With more data this gets slow fast.

  H-13 — Admin dashboard makes hundreds of queries per load
  Same N+1 problem. Dashboard polls itself, so this hammers the DB.

  H-14 — Auto-generated API docs page is empty
  40 endpoints are missing the info needed to document themselves. The /api/docs/ page is unusable.

  H-15 — Password rules are inconsistent
  First time setting password: must have uppercase + number. Later, changing password: just needs to be 8 chars. So you can downgrade your own security.

  H-16 — Errors are silently swallowed in attendance
  3 places say "try this, if it fails, do nothing". So if email or scheduling fails, you'll never know — attendance "starts" but the auto-end timer never gets scheduled.

  H-17 — Dead duplicate file breaks the build
  There are 2 "Start Attendance" dialogs. Only one is used. The other one is broken and is what's killing the production build (C-4). Delete it.

---

  🟡 MEDIUM (eventually)

remain: M2,M18

- M-1 Session URLs leak which group they belong to (via response timing).
- M-2 Reschedule a class twice in the same minute → second notification dropped.(remain)
- M-3 Notifications break if a group has 5,000+ members.
- M-4 Dashboard "filter by group" picker doesn't actually filter.
- M-5 Today's class on participant dashboard is missing some fields.
- M-6 "Show me 5 notifications" → always returns 20.
- M-7 Weird date in URL → server crashes with 500.

---

- M-8 Audit log "filter by type" dropdown does nothing.
- M-9 Submissions list ignores filter/search/pagination.
- M-10 Settings table has a race condition under first load.
- M-11 No error boundary — one broken page = entire site goes blank.
- M-12 Dashboard crashes on network error instead of showing "retry".
- M-13 Pages keep polling even when tab is hidden — burns battery and traffic.
- M-14 Session timer keeps ticking after time runs out.

---

M15 to m23 fixed except M18

- M-15 Profile photo upload accepts any file extension (.html, etc.).
- M-16 Upload PUT doesn't check if it succeeded — silent failures.
- M-17 Two different ways to handle timezones — DST will misbehave.
- M-18 You can schedule a class at "today 8am" when it's already 11am.(remain)
- M-19 Frontend tries to send notification types the DB doesn't allow.
- M-20 Cache keys are inconsistent — works today, will silently break later.
- M-21 Same endpoint registered twice with different URLs.
- M-22 Some field names differ between frontend types and backend output.
- M-23 Frontend assumes attendance status is always "PRESENT" — backend can send "ABSENT".

---

  🟢 LOW (whenever)

- L-1 Running the demo seed scripts in wrong order corrupts admin profile.
- L-2 File names with spaces work for browsers but break some tools.
- L-3 Missing production web server packages (gunicorn etc.) in requirements.
- L-4 Login animation runs even for users who hate motion.
- L-5 Login is forced to feel slow (3-second minimum loader).
- L-6 Bulk invite shows fake progress before doing real work.
- L-7 Calendar mobile view doesn't switch when you rotate the phone.
- L-8 Two helper scripts with hardcoded admin password live in the codebase.

---

  ⚙ DEPLOYMENT

- D-1 If you forget one env var, prod runs with developer settings (debug on, secrets exposed).
- D-2 Your production config file is barely 13 lines. Most production hardening isn't done.
- D-3 The secret key in .env is a weak placeholder.
- D-4 A script create_admin.py creates admin@ems.local / admin123. If it ever runs in prod, that's the admin account.
- D-5 No logging setup — errors disappear into the void.
- D-6 Frontend builds with localhost:8000 baked in because there's no .env.production file.
- D-2 Your production config file is barely 13 lines. Most production hardening isn't done.
- D-3 The secret key in .env is a weak placeholder.
- D-4 A script create_admin.py creates admin@ems.local / admin123. If it ever runs in prod, that's the admin account.
- D-5 No logging setup — errors disappear into the void.
- D-6 Frontend builds with localhost:8000 baked in because there's no .env.production file.
- D-7 No Docker file or deploy script for production. Everything is manual.
- D-8 docs/ folder is now in .gitignore — won't be pushed to GitHub (this is intentional per your notes).

---

  TL;DR

  Top 6 things to fix before anything else (about 2 hours of work):

1. The path traversal — anyone can steal your secrets
2. Forgot password — completely broken
3. Submission upload — files aren't actually uploaded

- D-7 No Docker file or deploy script for production. Everything is manual.
- D-8 docs/ folder is now in .gitignore — won't be pushed to GitHub (this is intentional per your notes).

---

  TL;DR

  Top 6 things to fix before anything else (about 2 hours of work):

1. The path traversal — anyone can steal your secrets
2. Forgot password — completely broken
3. Submission upload — files aren't actually uploaded
4. The broken production build
5. Submission field-name mismatch
6. Change password field-name mismatch
7. The broken production build
8. Submission field-name mismatch
9. Change password field-name mismatch

- L-4 Login animation runs even for users who hate motion.
- L-5 Login is forced to feel slow (3-second minimum loader).
- L-6 Bulk invite shows fake progress before doing real work.
- L-7 Calendar mobile view doesn't switch when you rotate the phone.
- L-8 Two helper scripts with hardcoded admin password live in the codebase.

---

  ⚙ DEPLOYMENT

- D-1 If you forget one env var, prod runs with developer settings (debug on, secrets exposed).
- D-2 Your production config file is barely 13 lines. Most production hardening isn't done.
- D-3 The secret key in .env is a weak placeholder.
- D-4 A script create_admin.py creates admin@ems.local / admin123. If it ever runs in prod, that's the admin account.
- D-5 No logging setup — errors disappear into the void.
- D-6 Frontend builds with localhost:8000 baked in because there's no .env.production file.
- D-7 No Docker file or deploy script for production. Everything is manual.
- D-8 docs/ folder is now in .gitignore — won't be pushed to GitHub (this is intentional per your notes).

---

  TL;DR

  Top 6 things to fix before anything else (about 2 hours of work):

1. The path traversal — anyone can steal your secrets
2. Forgot password — completely broken
3. Submission upload — files aren't actually uploaded
4. The broken production build
5. Submission field-name mismatch
6. Change password field-name mismatch

  Plus re-add the attendance window check that got deleted.

  Without these six fixes, the system is not safe to ship.
