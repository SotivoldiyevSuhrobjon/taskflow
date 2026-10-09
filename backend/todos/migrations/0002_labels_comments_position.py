import time

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("todos", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Label",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=30, unique=True)),
                ("color", models.CharField(default="#2563c9", max_length=7)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AlterModelOptions(
            name="task",
            options={"ordering": ["position", "id"]},
        ),
        migrations.AddField(
            model_name="task",
            name="position",
            field=models.FloatField(db_index=True, default=time.time),
        ),
        migrations.AddField(
            model_name="task",
            name="due_reminder_sent",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="task",
            name="labels",
            field=models.ManyToManyField(blank=True, related_name="tasks", to="todos.label"),
        ),
        migrations.CreateModel(
            name="Comment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.CharField(max_length=1000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="task_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="comments",
                        to="todos.task",
                    ),
                ),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
    ]
