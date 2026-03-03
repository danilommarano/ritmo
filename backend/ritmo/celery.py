"""
Celery app configuration for Ritmo.

Priority queues:
  - export_high   (Creator plan)
  - export_normal (Pro plan)
  - export_low    (Basic plan)
"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ritmo.settings')

app = Celery('ritmo')

# Read config from Django settings, namespace CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()
