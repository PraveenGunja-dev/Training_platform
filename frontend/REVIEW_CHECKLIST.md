# Sir Review Checklist (v2)

> Demo is on mock data. Both backend integration and Azure deploy come after this review.

## Login credentials (mocks)
- Admin: `admin@org.com` / `password123` — or use DevSwitcher → Admin
- Participant: `Rutvik.prajapati@adani.com` / `password123` — or DevSwitcher → Participant

> Note: Manager role has been removed. Only Admin and Participant exist now.

## Auth pages
- [ ] `/login` — premium navy + electric accent + gradient logo
- [ ] `/forgot-password` — submits, shows confirmation toast
- [ ] `/set-password/abc` — mock token accepts any value, redirects to dashboard

## Admin walk-through
- [ ] Dashboard renders 6+ charts with stagger animation
- [ ] Users page lists all users (no Manager rows)
- [ ] Class Groups — CRUD works
- [ ] Class Detail — "Start Attendance" button visible for ongoing class
- [ ] **Attendance flow** (the showcase):
  1. Open `/admin/attendance` → Active tab empty
  2. DevSwitcher → "Sim: Start Attendance" (or click Start on an ongoing class)
  3. Toast: "Attendance started · X participants emailed"
  4. Active tab now shows the live session
  5. Switch to Participant via DevSwitcher
  6. Within 10 s → live banner with pulse ring + enabled Mark button with UnlockAnimation
  7. Click Mark → toast + green "✓ Marked at HH:MM:SS" badge
  8. Switch back to Admin → End the session
  9. View Report → see Present rows + Absent rows + KPI strip
- [ ] Documents library + visibility filters
- [ ] Shared-uploads approval queue
- [ ] Audit log
- [ ] Settings

## Participant walk-through
- [ ] Dashboard card grid with stagger animation
- [ ] Calendar month + agenda view
- [ ] Class Detail with attendance state (no active session)
- [ ] Tasks list + Task Detail
- [ ] Submission upload (drag-drop, progress bar)
- [ ] My Submissions history
- [ ] Documents Received
- [ ] Notifications page + bell dropdown

## Responsive + a11y
- [ ] Resize to 360 px — sidebar collapses to hamburger
- [ ] Tab through Login form — all fields reachable
- [ ] DevTools → Rendering → `prefers-reduced-motion: reduce` → animations collapse, layout intact
- [ ] Lighthouse a11y ≥ 90 on every key page

## Visual quality
- [ ] Deep navy background with aurora gradient is visible
- [ ] Electric blue + violet gradient on primary buttons
- [ ] Inter Tight headings feel bold and modern
- [ ] Cards have hairline borders, subtle glow on hover
- [ ] Sonner toasts have rich colors + close button

## Things to call out
- All data is mocked. Real backend = next phase.
- Email sends are simulated via console toast.
- Manager role is gone; Admin owns everything.
