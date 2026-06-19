Fix issue from M15,M16,M17,M19,M20,M21,M22,M23 from the audit report at docs/tesinng_report.md.

  STEPS:

1. Read docs/tesinng_report.md and find the entry whose ID matches M15,M16,M17,M19,M20,M21,M22,M23 (e.g. "C-1", "H-5", "REG-2", "M-13", "L-4", "D-3").

   - If the code does not exist in the report, STOP and tell me.
   - If the code exists, extract: title, location (files/lines),
     bug description, repro steps, and recommended fix.
2. Read the actual source files referenced in that entry to confirm the
   bug is still present. If it has already been fixed, STOP and tell me.
3. Plan the fix:

   - Stick to the recommended fix in the report unless reading the code
     reveals a better path. If you deviate, say why.
   - Keep the change minimal. Do NOT refactor surrounding code, add
     features, or "clean up" anything unrelated.
   - Do NOT add error handling, fallbacks, or comments unless the fix
     specifically requires them.
4. Apply the fix.
5. Verify:

   - Backend changes: run `cd backend && .venv/Scripts/python.exe -m pytest`
     and show me the result. If a specific test from the report should
     now pass (e.g. REG-1 → test_start_session_outside_window), run that
     one explicitly and confirm it passes.
   - Frontend changes: run `cd frontend && npx tsc -b` (or `npm run build`
     if the issue is build-related) and show me the result.
   - If the issue is exploitable (path traversal, IDOR, etc.), reproduce
     the exploit BEFORE the fix to confirm it works, then re-run AFTER
     the fix to confirm it's blocked.
6. Record the decision in chunks/decisions.md:

   - Create the chunks/ folder and the decisions.md file if they do not
     exist yet.
   - Append (do not overwrite) a new entry at the bottom in this exact
     format:

     ## } — `<short title from the report>`

     **Date:** <today's date YYYY-MM-DD>
     **Status:** Fixed | Already-fixed | Skipped (with reason)
     **Files changed:**


     - <path/to/file.ext> (lines X-Y)
     - ...
       **What I changed:** <2-4 sentences in plain English — what the code
       does now that it didn't before, OR what was removed/added>
       **Why this approach:** <1-2 sentences — only if you deviated from
       the report's recommended fix>
       **Verification:** <test name + pass/fail, or curl repro + result>
       **Follow-ups / risks:** <anything left undone, related issues that
       got surfaced, or "none">

     ---
7. End with a one-paragraph summary: what was broken, what's fixed now,
   and what to test in the UI to confirm.

  RULES:

- Do NOT touch any issue other than M15,M16,M17,M19,M20,M21,M22,M23 even if you spot one
  nearby. List it under "Follow-ups" instead.
- Do NOT commit anything. Just stage in the working tree.
- Do NOT modify docs/tesinng_report.md.
- If you get blocked (test fails, can't find the file, fix breaks
  something else), STOP and ask me — don't paper over it.

---

  How to use

- Fix one issue: paste the prompt, replace {{CODE}} with C-1 → send.
- Fix several: run it once per code. Don't batch — each issue should get its own decision entry.
- Re-run later: you can re-paste with the same code; step 2 will catch that it's already fixed and stop.

  What you'll get in chunks/decisions.md

  A running log like:

## C-1 — Unauthenticated arbitrary file read via path-traversal

  **Date:** 2026-05-29
  **Status:** Fixed
  **Files changed:**

- backend/apps/assignments/dev_views.py (lines 14-36)
  **What I changed:** Added containment check using os.path.commonpath.
  Changed permission_classes from AllowAny to IsAuthenticated. The
  endpoint now rejects any blob_name that resolves outside dev_media/.
  **Verification:** Reproduced traversal via raw socket request before
  fix (returned .env contents). After fix, same request returns 404.
  **Follow-ups / risks:** D-1 (manage.py default settings module) still
  needs to be addressed to fully eliminate this in prod.

---

  This gives you a permanent decision log that survives across Claude Code sessions — useful for tracking what's been fixed and why.
