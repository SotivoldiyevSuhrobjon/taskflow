from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from config.celery import app as celery_app
from notifications.models import Notification
from notifications.tasks import send_due_reminders

from .models import Label, Task

User = get_user_model()


class TaskApiTests(APITestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        celery_app.conf.task_always_eager = True

    def setUp(self):
        self.alice = User.objects.create_user("alice", password="pass12345")
        self.bob = User.objects.create_user("bob", password="pass12345")
        self.carol = User.objects.create_user("carol", password="pass12345")

    def make_task(self, **kw):
        kw.setdefault("title", "A")
        kw.setdefault("created_by", self.alice)
        kw.setdefault("assigned_to", self.bob)
        return Task.objects.create(**kw)

    def test_create_assigns_and_notifies(self):
        self.client.force_authenticate(self.alice)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(
                "/api/tasks/", {"title": "Write docs", "assigned_to": self.bob.id}
            )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Notification.objects.filter(user=self.bob).count(), 1)

    def test_user_sees_only_own_tasks(self):
        self.make_task()
        self.client.force_authenticate(self.carol)
        self.assertEqual(len(self.client.get("/api/tasks/").data), 0)
        self.client.force_authenticate(self.bob)
        self.assertEqual(len(self.client.get("/api/tasks/").data), 1)

    def test_only_creator_can_delete(self):
        task = self.make_task()
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.delete(f"/api/tasks/{task.id}/").status_code, 403)
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.delete(f"/api/tasks/{task.id}/").status_code, 204)

    def test_invalid_status_rejected_and_any_column_allowed(self):
        task = self.make_task()
        self.client.force_authenticate(self.bob)
        bad = self.client.patch(f"/api/tasks/{task.id}/", {"status": "done"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.patch(f"/api/tasks/{task.id}/", {"status": "completed"})
        self.assertEqual(ok.status_code, 200)

    def test_drag_and_drop_position_and_order(self):
        a = self.make_task(title="a", position=1)
        b = self.make_task(title="b", position=2)
        self.client.force_authenticate(self.alice)
        res = self.client.patch(f"/api/tasks/{b.id}/", {"status": "pending", "position": 0.5})
        self.assertEqual(res.status_code, 200)
        titles = [t["title"] for t in self.client.get("/api/tasks/").data]
        self.assertEqual(titles, ["b", "a"])
        self.assertTrue(a.id)

    def test_assignee_cannot_edit_title_but_can_label(self):
        task = self.make_task()
        label = Label.objects.create(name="Hot", color="#ff0000")
        self.client.force_authenticate(self.bob)
        self.assertEqual(
            self.client.patch(f"/api/tasks/{task.id}/", {"title": "x"}).status_code, 403
        )
        res = self.client.patch(f"/api/tasks/{task.id}/", {"label_ids": [label.id]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["labels"][0]["name"], "Hot")

    def test_label_filter_and_creation(self):
        self.client.force_authenticate(self.alice)
        made = self.client.post("/api/labels/", {"name": "Spike", "color": "#123abc"})
        self.assertEqual(made.status_code, 201)
        self.assertEqual(
            self.client.post("/api/labels/", {"name": "Bad", "color": "red"}).status_code, 400
        )
        task = self.make_task()
        self.make_task(title="other")
        self.client.patch(f"/api/tasks/{task.id}/", {"label_ids": [made.data["id"]]}, format="json")
        res = self.client.get(f"/api/tasks/?label={made.data['id']}")
        self.assertEqual([t["id"] for t in res.data], [task.id])

    def test_comments_notify_other_side(self):
        task = self.make_task()
        self.client.force_authenticate(self.bob)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"/api/tasks/{task.id}/comments/", {"text": "On it"})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Notification.objects.filter(user=self.alice).count(), 1)
        self.assertEqual(len(self.client.get(f"/api/tasks/{task.id}/comments/").data), 1)
        self.assertEqual(self.client.get("/api/tasks/").data[0]["comments_count"], 1)
        self.client.force_authenticate(self.carol)
        self.assertEqual(self.client.get(f"/api/tasks/{task.id}/comments/").status_code, 404)

    def test_empty_comment_rejected(self):
        task = self.make_task()
        self.client.force_authenticate(self.alice)
        res = self.client.post(f"/api/tasks/{task.id}/comments/", {"text": "   "})
        self.assertEqual(res.status_code, 400)

    def test_due_reminders_sent_once(self):
        today = timezone.localdate()
        self.make_task(title="soon", due_date=today + timedelta(days=1))
        self.make_task(title="later", due_date=today + timedelta(days=5))
        self.make_task(title="done", due_date=today, status="completed")
        self.assertEqual(send_due_reminders(), 1)
        self.assertEqual(send_due_reminders(), 0)
        self.assertEqual(Notification.objects.filter(user=self.bob).count(), 1)

    def test_mark_notification_read(self):
        n = Notification.objects.create(user=self.alice, message="hi")
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.patch(f"/api/notifications/{n.id}/read/").status_code, 404)
        self.client.force_authenticate(self.alice)
        res = self.client.patch(f"/api/notifications/{n.id}/read/")
        self.assertTrue(res.data["is_read"])
