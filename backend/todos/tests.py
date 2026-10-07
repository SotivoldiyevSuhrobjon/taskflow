from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from config.celery import app as celery_app
from notifications.models import Notification

from .models import Task

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

    def test_create_assigns_and_notifies(self):
        self.client.force_authenticate(self.alice)
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(
                "/api/tasks/", {"title": "Write docs", "assigned_to": self.bob.id}
            )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Notification.objects.filter(user=self.bob).count(), 1)

    def test_user_sees_only_own_tasks(self):
        Task.objects.create(title="A", created_by=self.alice, assigned_to=self.bob)
        self.client.force_authenticate(self.carol)
        self.assertEqual(len(self.client.get("/api/tasks/").data), 0)
        self.client.force_authenticate(self.bob)
        self.assertEqual(len(self.client.get("/api/tasks/").data), 1)

    def test_only_creator_can_delete(self):
        task = Task.objects.create(title="A", created_by=self.alice, assigned_to=self.bob)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.delete(f"/api/tasks/{task.id}/").status_code, 403)
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.delete(f"/api/tasks/{task.id}/").status_code, 204)

    def test_status_must_move_one_step(self):
        task = Task.objects.create(title="A", created_by=self.alice, assigned_to=self.bob)
        self.client.force_authenticate(self.bob)
        bad = self.client.patch(f"/api/tasks/{task.id}/", {"status": "completed"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.patch(f"/api/tasks/{task.id}/", {"status": "in_progress"})
        self.assertEqual(ok.status_code, 200)

    def test_mark_notification_read(self):
        n = Notification.objects.create(user=self.alice, message="hi")
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.patch(f"/api/notifications/{n.id}/read/").status_code, 404)
        self.client.force_authenticate(self.alice)
        res = self.client.patch(f"/api/notifications/{n.id}/read/")
        self.assertTrue(res.data["is_read"])
