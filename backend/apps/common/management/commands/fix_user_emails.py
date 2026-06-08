"""
fix_user_emails management command.

Updates all legacy p{n}@org.com / asha@org.com / kiran.nair@adani.com style
accounts to use real names and firstname.lastname@adani.com emails.

Usage:
  python manage.py fix_user_emails
"""

from django.core.management.base import BaseCommand

from apps.accounts.models import User


PARTICIPANT_UPDATES = [
    ("p1@org.com",  "rutvik.prajapati@adani.com", "Rutvik Prajapati"),
    ("p2@org.com",  "priya.sharma@adani.com",      "Priya Sharma"),
    ("p3@org.com",  "arjun.mehta@adani.com",       "Arjun Mehta"),
    ("p4@org.com",  "divya.nair@adani.com",        "Divya Nair"),
    ("p5@org.com",  "rohan.verma@adani.com",       "Rohan Verma"),
    ("p6@org.com",  "sneha.patel@adani.com",       "Sneha Patel"),
    ("p7@org.com",  "vikram.singh@adani.com",      "Vikram Singh"),
    ("p8@org.com",  "anita.desai@adani.com",       "Anita Desai"),
    ("p9@org.com",  "rahul.gupta@adani.com",       "Rahul Gupta"),
    ("p10@org.com", "kavya.reddy@adani.com",       "Kavya Reddy"),
    ("p11@org.com", "amit.kumar@adani.com",        "Amit Kumar"),
    ("p12@org.com", "pooja.iyer@adani.com",        "Pooja Iyer"),
    ("p13@org.com", "suresh.joshi@adani.com",      "Suresh Joshi"),
    ("p14@org.com", "meera.pillai@adani.com",      "Meera Pillai"),
    ("p15@org.com", "nikhil.shah@adani.com",       "Nikhil Shah"),
    ("p16@org.com", "tanvi.saxena@adani.com",      "Tanvi Saxena"),
    ("p17@org.com", "deepak.rao@adani.com",        "Deepak Rao"),
    ("p18@org.com", "shreya.banerjee@adani.com",   "Shreya Banerjee"),
    ("p19@org.com", "karan.malhotra@adani.com",    "Karan Malhotra"),
    ("p20@org.com", "nisha.agarwal@adani.com",     "Nisha Agarwal"),
    ("p21@org.com", "sanjay.mishra@adani.com",     "Sanjay Mishra"),
    ("p22@org.com", "aisha.qureshi@adani.com",     "Aisha Qureshi"),
    ("p23@org.com", "ravi.krishnan@adani.com",     "Ravi Krishnan"),
    ("p24@org.com", "sonal.kapoor@adani.com",      "Sonal Kapoor"),
    ("p25@org.com", "gaurav.pandey@adani.com",     "Gaurav Pandey"),
]

ADMIN_UPDATES = [
    ("asha@org.com",    "kiran.kr@adani.com",   "Kiran K R"),
    ("manish@org.com",  "manish.kumar@adani.com", "Manish Kumar"),
    ("mira@org.com",    "mira.sharma@adani.com",  "Mira Sharma"),
]


class Command(BaseCommand):
    help = "Update legacy p{n}@org.com accounts to real names and @adani.com emails."

    def handle(self, *args, **options):
        self.stdout.write("Updating user emails and names …\n")
        updated = 0
        skipped = 0

        for old_email, new_email, full_name in PARTICIPANT_UPDATES + ADMIN_UPDATES:
            old_qs = User.objects.filter(email=old_email)
            new_qs = User.objects.filter(email=new_email)

            new_exists = new_qs.exists()
            old_exists = old_qs.exists()

            if new_exists and old_exists:
                # Both rows exist — old one is the stale duplicate.
                # Delete the stale seeded copy, keep the original row (old_email)
                # and rename it to the new email.
                new_qs.delete()
                old_qs.update(email=new_email, full_name=full_name)
                self.stdout.write(f"  ✓  {old_email:30s} → {new_email}  (removed duplicate)")
                updated += 1

            elif new_exists and not old_exists:
                # Already migrated — just make sure the name is correct.
                new_qs.update(full_name=full_name)
                self.stdout.write(f"  ✓  {new_email:30s}  already migrated, name confirmed")
                updated += 1

            elif old_exists:
                # Normal path — rename in place.
                old_qs.update(email=new_email, full_name=full_name)
                self.stdout.write(f"  ✓  {old_email:30s} → {new_email}")
                updated += 1

            else:
                self.stdout.write(f"  –  {old_email:30s}  (not found, skipped)")
                skipped += 1

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Done. {updated} updated, {skipped} not found.")
        )
