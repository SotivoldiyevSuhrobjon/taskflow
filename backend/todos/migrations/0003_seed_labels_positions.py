from django.db import migrations

DEFAULT_LABELS = [
    ("Urgent", "#d8432b"),
    ("Bug", "#e07b00"),
    ("Feature", "#2f855a"),
    ("Design", "#7c3aed"),
    ("Docs", "#2563c9"),
    ("Research", "#0e8aa8"),
]


def seed(apps, schema_editor):
    Label = apps.get_model("todos", "Label")
    Task = apps.get_model("todos", "Task")
    for name, color in DEFAULT_LABELS:
        Label.objects.get_or_create(name=name, defaults={"color": color})
    # Eski vazifalar: tartib id bo'yicha (yangi vazifalar time.time bilan oxirida turadi)
    for task in Task.objects.all():
        task.position = float(task.pk)
        task.save(update_fields=["position"])


class Migration(migrations.Migration):
    dependencies = [("todos", "0002_labels_comments_position")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
