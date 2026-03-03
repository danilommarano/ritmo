"""
Tests for Celery export tasks.
"""
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from videos.models import Video
from billing.models import (
    CreditBalance, CreditTransaction, ExportJob,
)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class RunExportTaskTests(TestCase):
    """Tests for videos.tasks.run_export Celery task."""

    def setUp(self):
        self.user = User.objects.create_user('taskuser', 'task@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Task Video', owner=self.user,
            file='videos/task_test.mp4', duration=120.0,
            width=1920, height=1080, fps=30.0,
        )
        self.balance = CreditBalance.objects.create(
            user=self.user,
            subscription_minutes=Decimal('50.00'),
            purchased_minutes=Decimal('10.00'),
        )

    def _create_job(self, **kwargs):
        defaults = dict(
            user=self.user,
            video=self.video,
            status='reserved',
            resolution='1080p',
            priority='normal',
            estimated_duration_minutes=Decimal('2.00'),
            credits_consumed=Decimal('2.00'),
            credit_multiplier=Decimal('1.00'),
            export_params={
                'elements': [],
                'start_time': 0,
                'end_time': 60,
                'video_metadata': {
                    'width': 1920, 'height': 1080,
                    'duration': 120.0, 'fps': 30.0,
                },
                'bpm_config': {'bpm': 120, 'timeSignatureNum': 4, 'offsetStart': 0},
                'video_segments': None,
                'preview_width': None,
                'preview_height': None,
            },
        )
        defaults.update(kwargs)
        return ExportJob.objects.create(**defaults)

    @patch('videos.video_processor.export_video_with_elements')
    def test_successful_export(self, mock_export):
        """Task completes and marks job as completed."""
        mock_export.return_value = '/tmp/output_test.mp4'

        from videos.tasks import run_export
        job = self._create_job()

        with patch('os.path.getsize', return_value=1024000):
            result = run_export(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, 'completed')
        self.assertIsNotNone(job.started_at)
        self.assertIsNotNone(job.completed_at)
        self.assertEqual(job.output_file_url, '/tmp/output_test.mp4')
        self.assertEqual(job.output_file_size, 1024000)
        self.assertEqual(result['status'], 'completed')

    @patch('videos.tasks.export_video_with_elements')
    def test_failed_export_refunds_credits(self, mock_export):
        """Task failure should refund credits to the user."""
        mock_export.side_effect = Exception('FFmpeg crashed')

        from videos.tasks import run_export
        job = self._create_job(credits_consumed=Decimal('5.00'))

        # Simulate that credits were already debited
        self.balance.subscription_minutes -= Decimal('5.00')
        self.balance.save()
        initial_balance = self.balance.total_minutes

        result = run_export(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, 'failed')
        self.assertIn('FFmpeg crashed', job.error_message)

        # Credits should be refunded
        self.balance.refresh_from_db()
        self.assertEqual(
            self.balance.total_minutes,
            initial_balance + Decimal('5.00'),
        )

        # Refund transaction should exist
        refund_tx = CreditTransaction.objects.filter(
            user=self.user, transaction_type='refund',
        )
        self.assertEqual(refund_tx.count(), 1)
        self.assertEqual(refund_tx.first().minutes, Decimal('5.00'))

    def test_job_not_found(self):
        from videos.tasks import run_export
        result = run_export(99999)
        self.assertEqual(result['status'], 'error')

    def test_skips_already_completed_job(self):
        from videos.tasks import run_export
        job = self._create_job(status='completed')
        result = run_export(job.id)
        self.assertEqual(result['status'], 'skipped')

    def test_skips_canceled_job(self):
        from videos.tasks import run_export
        job = self._create_job(status='canceled')
        result = run_export(job.id)
        self.assertEqual(result['status'], 'skipped')

    @patch('videos.tasks.export_video_with_elements')
    def test_pending_job_also_processed(self, mock_export):
        """Jobs in 'pending' status should also be processed."""
        mock_export.return_value = '/tmp/out.mp4'
        from videos.tasks import run_export
        job = self._create_job(status='pending')

        with patch('os.path.getsize', return_value=512):
            result = run_export(job.id)

        job.refresh_from_db()
        self.assertEqual(job.status, 'completed')

    @patch('videos.tasks.export_video_with_elements')
    def test_export_params_passed_correctly(self, mock_export):
        """Task should pass export_params to export_video_with_elements."""
        mock_export.return_value = '/tmp/out.mp4'

        from videos.tasks import run_export
        params = {
            'elements': [{'type': 'text', 'text': 'Hello'}],
            'start_time': 10,
            'end_time': 50,
            'video_metadata': {'width': 1920, 'height': 1080, 'duration': 120.0, 'fps': 30.0},
            'bpm_config': {'bpm': 140, 'timeSignatureNum': 4, 'offsetStart': 0.5},
            'video_segments': [{'start_time': 10, 'end_time': 50, 'speed': 1.0}],
            'preview_width': 800,
            'preview_height': 450,
        }
        job = self._create_job(export_params=params)

        with patch('os.path.getsize', return_value=100):
            run_export(job.id)

        call_kwargs = mock_export.call_args
        self.assertEqual(call_kwargs.kwargs.get('start_time') or call_kwargs[1].get('start_time'), 10)
        self.assertEqual(call_kwargs.kwargs.get('end_time') or call_kwargs[1].get('end_time'), 50)


class PriorityQueueMapTests(TestCase):
    """Tests for priority queue routing."""

    def test_queue_mapping(self):
        from videos.tasks import PRIORITY_QUEUE_MAP
        self.assertEqual(PRIORITY_QUEUE_MAP['high'], 'export_high')
        self.assertEqual(PRIORITY_QUEUE_MAP['normal'], 'export_normal')
        self.assertEqual(PRIORITY_QUEUE_MAP['low'], 'export_low')
