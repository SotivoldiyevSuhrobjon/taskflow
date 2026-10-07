from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from accounts.serializers import UserSerializer

from .models import Task

User = get_user_model()
STATUS_ORDER = [s.value for s in Task.Status]


class TaskSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    assigned_to_user = UserSerializer(source="assigned_to", read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "description",
            "status",
            "created_by",
            "assigned_to",
            "assigned_to_user",
            "due_date",
            "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_status(self, value):
        if self.instance is not None and value != self.instance.status:
            step = STATUS_ORDER.index(value) - STATUS_ORDER.index(self.instance.status)
            if abs(step) != 1:
                raise serializers.ValidationError(
                    "Status moves one step at a time: "
                    "pending -> in_progress -> completed."
                )
        return value

    def validate(self, attrs):
        request = self.context["request"]
        if self.instance is not None and self.instance.created_by_id != request.user.id:
            if set(attrs) - {"status"}:
                raise PermissionDenied(
                    "Only the creator can edit task details. "
                    "Assignees can change the status only."
                )
        return attrs
