import json
import logging
import urllib.request

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from .models import Notification

logger = logging.getLogger(__name__)


def _send_email(user, message):
    if settings.EMAIL_NOTIFICATIONS and user.email:
        send_mail("New notification", message, None, [user.email], fail_silently=False)


def _send_telegram(message):
    token, chat_id = settings.TELEGRAM_BOT_TOKEN, settings.TELEGRAM_CHAT_ID
    if not (token and chat_id):
        return
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=json.dumps({"chat_id": chat_id, "text": message}).encode(),
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=10)


@shared_task
def create_notification(user_id, message):
    """Bildirishnomani bazaga yozadi, so'ng (ixtiyoriy) email/Telegram yuboradi."""
    notification = Notification.objects.create(user_id=user_id, message=message)
    user = get_user_model().objects.filter(pk=user_id).first()
    for sender in (lambda: _send_email(user, message), lambda: _send_telegram(message)):
        try:
            if user:
                sender()
        except Exception:  # tashqi xizmat xatosi asosiy jarayonni buzmasin
            logger.exception("External notification failed")
    return notification.id
