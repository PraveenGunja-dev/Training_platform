# Adding Users – Phase 2 Summary

**Date:** 2026-06-17
**Source files:**
- `docs deployment/Found_Names_Output.xlsx` → Sheet: **Found**
- `docs deployment/aclp excel.xlsx` → Sheet: **Sheet5**

---

## Part 1 — User Import (Found_Names_Output.xlsx)

### What Was Done
Read the **Found** sheet (62 data rows, columns: Name · Employee Code · Email · Business Unit · Department) and inserted all users into the portal as **PARTICIPANT** role.

### Normalization Applied
- Emails stored in **lowercase**
- Names **title-cased** and extra/double spaces removed (e.g. `RINESH SANGHAVI` → `Rinesh Sanghavi`, `Pragnesh  Darji` → `Pragnesh Darji`)
- Employee codes stored as strings (handles non-numeric values like `ashok.jageti`, `AMPCW1243301`)
- Missing employee code (Mantu Kumar) stored as empty string `''`
- Default password: `admin123` with `must_change_password = True`

### Result

| Status | Count |
|---|---|
| **Created** (new users) | 59 |
| **Skipped** (already existed, all fields complete) | 3 |
| **Failed** | 0 |
| **Missing data** (not inserted) | 0 |
| **Total confirmed in DB after import** | 62 |

### 3 Already-Existing Users (no changes made)
| Name | Email |
|---|---|
| Hareshkumar Bhuva | hareshv.bhuva@adani.com |
| Anand Singal | anand.singhal@adani.com |
| Arpan Shah | arpan.shah@adani.com |

---

## Part 2 — Role Assignment (aclp excel.xlsx → Sheet5)

### What Was Done
Read **Sheet5** (25 batches × 4 columns: Batch · Super Admin · Instructor 1 · Instructor 2 · Instructor 3).

For each person:
1. Looked up by `full_name` (case-insensitive) in the DB
2. Updated their system `role` field
3. Created the group-level assignment record

### Column → Role Mapping

| Excel Column | System Role | Group Record Created |
|---|---|---|
| Super Admin | `GROUP_ADMIN` | `GroupAdmin` (one per group) |
| Instructor 1 / 2 / 3 | `INSTRUCTOR` | `GroupInstructor` |

> **Priority rule:** If the same person appeared as Group Admin in one batch and Instructor in another, `GROUP_ADMIN` takes precedence for the system role field.

> **Special alias:** `Anand Singhal` (Excel) → matched to `Anand Singal` (DB spelling mismatch) — assigned successfully as Instructor 3 in Batch 25 - GCC FMC 2.

### Result

| Action | Count |
|---|---|
| **Role changes applied** (PARTICIPANT → GROUP_ADMIN or INSTRUCTOR) | 62 |
| **Group Admin assignments created** | 15 |
| **Instructor assignments created** | 45 |
| **Already assigned** (skipped, no duplicate) | 2 |

### Group Admin Assignments (15)
| Person | Assigned To |
|---|---|
| Anupam Misra | Batch-1 |
| Suresh Chandra Jain | Batch-2 |
| Manan Vakharia | Batch-6 |
| Kamal Harlalka | Batch-7 |
| Kiran K R | Batch-8 |
| Nitin Chaturvedi | Batch-9 |
| Prateek Tandon | Batch-10 |
| Rahul Kumar | Batch-12 |
| Pragnesh Darji | Batch-13 |
| Prashant Soni | Batch-14 |
| Dilip Jha | Batch-18 |
| Sandesh Shinde | Batch-19 |
| Nirmal Shah | Batch 20- GCC FMC 1 |
| Arpan Shah | Batch-22 |
| Ryan Dsouza | Batch 23 - GCC General |
| Amrendra Kumar Sinha | Batch-24 |
| Sudesh Jain | Batch 25 - GCC FMC 2 |

> Note: Batches 3, 4, 5, 11, 15, 16, 17, 21 have **no Group Admin assigned** — see Issues section below.

### Instructor Assignments (45)
| Person | Batch |
|---|---|
| Akshaykumar Gupta | Batch-1 |
| Kapil Batra | Batch-1 |
| Jaykishan Birla | Batch-2 |
| D Sunil Kumar | Batch-3 |
| Neeraj Das | Batch-4 |
| Srikanth Gudivada | Batch-4 |
| Ashok Jagetiya | Batch-5 |
| Chetania Shah | Batch-5 |
| Natabar Sahu | Batch-6 |
| Ravi Jain | Batch-6 |
| Abhiram Budhkar | Batch-7 |
| Shashank Bothra | Batch-8 |
| Puneet Bansal | Batch-8 |
| Kevin Buddhadev | Batch-9 |
| Jwalit Vyas | Batch-9 |
| Kalpesh Pathak | Batch-10 |
| Arun Maheshwari | Batch-10 |
| Vijil Jain | Batch-11 |
| Mishra Amitabh | Batch-12 |
| Pammi Bhaskaraiah | Batch-12 |
| Jay Ambani | Batch-13 |
| Yashovardhan Joshi | Batch-13 |
| Pramath Nath | Batch-14 |
| Prabhu Dhulipala | Batch-14 |
| Sanjay Kumar Khajanchi | Batch-15 |
| Anagha Thekkekkara | Batch-15 |
| Chandrahas Sampat | Batch-16 |
| Amitabh Mishra | Batch-17 |
| Rinesh Sanghavi | Batch-17 |
| Pujan Shah | Batch-18 |
| Kuntal Parikh | Batch-19 |
| Abhishek Chattopadhyay | Batch-19 |
| Manish Patel | Batch 20- GCC FMC 1 |
| Jeetendra Menghani | Batch 20- GCC FMC 1 |
| Kapil Tanna | Batch-21 |
| Chirag Vakharia | Batch-21 |
| Sanjoy Kumar Agarwal | Batch-22 |
| Rohit Chhabra | Batch-22 |
| Kamlesh Bhagia | Batch 23 - GCC General |
| Mantu Kumar | Batch 23 - GCC General |
| Jigar Dalal | Batch-24 |
| Nishit Dave | Batch-24 |
| Hareshkumar Bhuva | Batch 25 - GCC FMC 2 |
| Sudeep Sarkar | Batch 25 - GCC FMC 2 |
| Anand Singal | Batch 25 - GCC FMC 2 |

---

## Phase 3 — Remaining Users (Found_Names_Output.xlsx → Sheet P3)

**Date:** 2026-06-17

### What Was Done
Read the **P3** sheet (17 rows) — these were people whose data was missing during Phase 2 but were now available. Imported as PARTICIPANT, then re-ran Sheet5 role assignments for their respective batches.

### Result

| Status | Count |
|---|---|
| **Created** (new users) | 16 |
| **Skipped** (email already existed) | 1 |
| **Role changes applied** | 14 |
| **Group Admin assignments created** | 8 |
| **Instructor assignments created** | 6 |
| **Issues** | 0 |

### 1 Skipped User
| Name | Email | Reason |
|---|---|---|
| Manish Patel | manish.patel@adani.com | Email already existed in DB (different record — safety.cell-line context). The existing record was already correctly assigned to Batch-20 as instructor. |

### Group Admin Assignments Completed in P3 (8)
| Person | Batch |
|---|---|
| Dinesh Sonthalia | Batch-3 |
| Rohit Soni | Batch-4 |
| Harish Sharma | Batch-5 |
| Rahul Choudhary | Batch-11 |
| Saurabh Shah | Batch-15 |
| Pranav Mehta | Batch-16 |
| Sreedhar Krishna Menon | Batch-17 |
| Niraj Shah | Batch-21 |

### Instructor Assignments Completed in P3 (6)
| Person | Batch |
|---|---|
| Gaurav Garg | Batch-2 |
| Abhishek Jain | Batch-3 |
| Sachin Kumar Gupta | Batch-7 |
| Tejas Shah | Batch-11 |
| Ankit Shah | Batch-16 |
| Amit Jain | Batch-18 |

### Name Aliases Used in P3 Script
| Excel Name | DB Name |
|---|---|
| Krishna Menon | Sreedhar Krishna Menon |
| Dinesh Kumar Sonthalia | Dinesh Sonthalia |

---

## Final Status — All 25 Batches

All 25 batches now have full Group Admin and Instructor coverage. No outstanding missing slots remain.

---

## Issues — Resolved (Previously 15, now 0)

All 14 previously missing people (+ 1 alias) have been registered and assigned:

| Batch | Role | Person | Status |
|---|---|---|---|
| Batch-2 | Instructor 2 | Gaurav Garg | ✅ Added + Assigned (P3) |
| Batch-3 | Group Admin | Dinesh Sonthalia | ✅ Added + Assigned (P3) |
| Batch-3 | Instructor 2 | Abhishek Jain | ✅ Added + Assigned (P3) |
| Batch-4 | Group Admin | Rohit Soni | ✅ Added + Assigned (P3) |
| Batch-5 | Group Admin | Harish Sharma | ✅ Added + Assigned (P3) |
| Batch-7 | Instructor 2 | Sachin Kumar Gupta | ✅ Added + Assigned (P3) |
| Batch-11 | Group Admin | Rahul Choudhary | ✅ Added + Assigned (P3) |
| Batch-11 | Instructor 2 | Tejas Shah | ✅ Added + Assigned (P3) |
| Batch-15 | Group Admin | Saurabh Shah | ✅ Added + Assigned (P3) |
| Batch-16 | Group Admin | Pranav Mehta | ✅ Added + Assigned (P3) |
| Batch-16 | Instructor 1 | Ankit Shah | ✅ Added + Assigned (P3) |
| Batch-17 | Group Admin | Sreedhar Krishna Menon | ✅ Added + Assigned (P3) |
| Batch-18 | Instructor 1 | Amit Jain | ✅ Added + Assigned (P3) |
| Batch-21 | Group Admin | Niraj Shah | ✅ Added + Assigned (P3) |
| Batch-25 GCC FMC 2 | Instructor 3 | Anand Singhal (→ Anand Singal) | ✅ Resolved via alias (Phase 2) |

---

## Technical Notes

- All role changes used Django `User.save(update_fields=['role'])` — no cascade side effects
- `GroupAdmin` uses `update_or_create(group=group, ...)` — safe to re-run without duplicates
- `GroupInstructor` uses `get_or_create(group=group, instructor=u, ...)` — safe to re-run
- Script files: temporary, deleted after execution
- Backend settings used: `config.settings.dev`
- Emails normalized to lowercase; names title-cased with double-space removal at import time
