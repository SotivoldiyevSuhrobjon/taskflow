import logging

from django.db import transaction
from django.db.models import Count, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from notifications.tasks import create_notification

from .models import Label, Task
from .serializers import CommentSerializer, LabelSerializer, TaskSerializer

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


class LabelViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = Label.objects.all()
    serializer_class = LabelSerializer


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Task.objects.filter(Q(created_by=user) | Q(assigned_to=user))
            .select_related("created_by", "assigned_to")
            .prefetch_related("labels")
            .annotate(comments_count=Count("comments", distinct=True))
            .distinct()
        )
        params = self.request.query_params
        status_ = params.get("status")
        title = params.get("title")
        label = params.get("label")
        if status_:
            if status_ not in Task.Status.values:
                raise ValidationError({"status": f"Choose one of {Task.Status.values}."})
            qs = qs.filter(status=status_)
        if title:
            qs = qs.filter(title__icontains=title)
        if label:
            if not label.isdigit():
                raise ValidationError({"label": "Must be a label id."})
            qs = qs.filter(labels__id=int(label))
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
        old_due = serializer.instance.due_date
        task = serializer.save()

        if task.due_date != old_due and task.due_reminder_sent:
            task.due_reminder_sent = False
            task.save(update_fields=["due_reminder_sent"])

        if task.assigned_to_id and task.assigned_to_id not in (old_assignee, actor.id):
            notify(
                task.assigned_to_id,
                f'{actor.username} assigned you a task: "{task.title}"',
            )
        if task.status != old_status:
            recipients = {task.created_by_id, task.assigned_to_id} - {None, actor.id}
            label = Task.Status(task.status).label
            for user_id in recipients:
                notify(user_id, f'{actor.username} moved "{task.title}" to {label}')

    def perform_destroy(self, instance):
        if instance.created_by_id != self.request.user.id:
            raise PermissionDenied("Only the creator can delete this task.")
        instance.delete()

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        """GET: vazifa kommentlari. POST: yangi komment (boshqa tomonga bildirishnoma)."""
        task = self.get_object()  # faqat ko'ra oladigan odam komment yoza oladi
        if request.method == "POST":
            serializer = CommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            comment = serializer.save(task=task, author=request.user)
            recipients = {task.created_by_id, task.assigned_to_id} - {None, request.user.id}
            for user_id in recipients:
                notify(user_id, f'{request.user.username} commented on "{task.title}"')
            return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)
        queryset = task.comments.select_related("author")
        return Response(CommentSerializer(queryset, many=True).data)
