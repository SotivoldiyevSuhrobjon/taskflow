import math
import re

from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from accounts.serializers import UserSerializer

from .models import Comment, Label, Task

User = get_user_model()

# Vazifa yaratuvchisi bo'lmagan (biriktirilgan) odam o'zgartira oladigan maydonlar
ASSIGNEE_FIELDS = {"status", "position", "labels"}


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ("id", "name", "color")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Label name cannot be empty.")
        return value

    def validate_color(self, value):
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise serializers.ValidationError("Use a hex color like #2563c9.")
        return value.lower()


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "author", "text", "created_at")
        read_only_fields = ("id", "author", "created_at")

    def validate_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Comment cannot be empty.")
        return value


class TaskSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    assigned_to_user = UserSerializer(source="assigned_to", read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    label_ids = serializers.PrimaryKeyRelatedField(
        queryset=Label.objects.all(), many=True, required=False, write_only=True, source="labels"
    )
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "description",
            "status",
            "position",
            "created_by",
            "assigned_to",
            "assigned_to_user",
            "due_date",
            "created_at",
            "labels",
            "label_ids",
            "comments_count",
        )
        read_only_fields = ("id", "created_at")
        extra_kwargs = {"description": {"max_length": 2000}, "position": {"required": False}}

    def get_comments_count(self, obj):
        value = getattr(obj, "comments_count", None)
        return value if value is not None else obj.comments.count()

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value

    def validate_position(self, value):
        if not math.isfinite(value):
            raise serializers.ValidationError("Position must be a finite number.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        if self.instance is not None and self.instance.created_by_id != request.user.id:
            if set(attrs) - ASSIGNEE_FIELDS:
                raise PermissionDenied(
                    "Only the creator can edit task details. "
                    "Assignees can change status, position and labels only."
                )
        return attrs
