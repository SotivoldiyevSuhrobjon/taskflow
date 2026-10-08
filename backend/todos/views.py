import logging

from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from notifications.tasks import create_notification

from .models import Task
from .serializers import TaskSerializer


logger = logging.getLogger(__name__)


def _dispatch(user_id, message):
    try:
        create_notification.delay(user_id, message)
    except Exception:  # Redis/broker ishlamasa ham API 500 bermasin
        logger.warning("Celery broker unavailable, creating notification synchronously")
        create_notification(user_id, message)


def notify(user_id, message):
    """Task commit bo'lgandan keyingina Celery'ga yuboriladi."""
    transaction.on_commit(lambda: _dispatch(user_id, message))


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Task.objects.filter(Q(created_by=user) | Q(assigned_to=user))
            .select_related("created_by", "assigned_to")
            .distinct()
        )
        params = self.request.query_params
        status = params.get("status")
        title = params.get("title")
        if status:
            if status not in Task.Status.values:
                raise ValidationError({"status": f"Choose one of {Task.Status.values}."})
            qs = qs.filter(status=status)
        if title:
            qs = qs.filter(title__icontains=title)
        return qs

    def perform_create(self, serializer):
        actor = self.request.user
        task = serializer.save(created_by=actor)
        if task.assigned_to_id and task.assigned_to_id != actor.id:
            notify(
                task.assigned_to_id,
                f'{actor.username} assigned you a new task: "{task.title}"',
            )

    def perform_update(self, serializer):
        actor = self.request.user
        old_status = serializer.instance.status
        old_assignee = serializer.instance.assigned_to_id
        task = serializer.save()

        if task.assigned_to_id and task.assigned_to_id not in (old_assignee, actor.id):
            notify(
                task.assigned_to_id,
                f'{actor.username} assigned you a task: "{task.title}"',
            )
        if task.status != old_status:
            recipients = {task.created_by_id, task.assigned_to_id} - {None, actor.id}
            label = Task.Status(task.status).label
            for user_id in recipients:
                notify(
                    user_id,
                    f'{actor.username} moved "{task.title}" to {label}',
                )

    def perform_destroy(self, instance):
        if instance.created_by_id != self.request.user.id:
            raise PermissionDenied("Only the creator can delete this task.")
        instance.delete()
