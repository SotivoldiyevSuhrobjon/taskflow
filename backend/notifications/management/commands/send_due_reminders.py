from django.core.management.base import BaseCommand

from notifications.tasks import send_due_reminders


class Command(BaseCommand):
    help = "Muddati yaqin vazifalar uchun eslatma bildirishnomalarini yaratadi."

    def handle(self, *args, **options):
        count = send_due_reminders()
        self.stdout.write(self.style.SUCCESS(f"Reminders sent: {count}"))
