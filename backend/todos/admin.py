from django.contrib import admin

from .models import Comment, Label, Task

admin.site.register(Task)
admin.site.register(Label)
admin.site.register(Comment)
