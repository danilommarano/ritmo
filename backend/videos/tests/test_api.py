"""
Tests for video API endpoints.
"""
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from videos.models import Video, RhythmGrid, Fragment


class VideoListAPITests(TestCase):
    """Tests for GET /api/videos/videos/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('listuser', 'list@test.com', 'pass1234')

    def test_anonymous_with_session_key(self):
        """Anonymous user can list their own videos via X-Session-Key."""
        Video.objects.create(
            title='Anon Vid', session_key='sess-123',
            file='videos/anon.mp4', duration=60.0,
        )
        response = self.client.get(
            '/api/videos/videos/',
            HTTP_X_SESSION_KEY='sess-123',
        )
        self.assertEqual(response.status_code, 200)

    def test_authenticated_user_sees_own_videos(self):
        Video.objects.create(
            title='My Video', owner=self.user,
            file='videos/mine.mp4', duration=60.0,
        )
        other = User.objects.create_user('other', 'other@test.com', 'pass1234')
        Video.objects.create(
            title='Other Video', owner=other,
            file='videos/other.mp4', duration=60.0,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/videos/videos/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        titles = [v['title'] for v in data.get('results', data)]
        self.assertIn('My Video', titles)
        self.assertNotIn('Other Video', titles)


class VideoDetailAPITests(TestCase):
    """Tests for GET /api/videos/videos/{id}/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('detuser', 'det@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Detail Video', owner=self.user,
            file='videos/detail.mp4', duration=120.0,
            width=1920, height=1080, fps=30.0,
        )

    def test_owner_can_view(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/api/videos/videos/{self.video.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Detail Video')

    def test_owner_can_update_title(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            f'/api/videos/videos/{self.video.id}/',
            {'title': 'New Title'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.video.refresh_from_db()
        self.assertEqual(self.video.title, 'New Title')


class RhythmGridAPITests(TestCase):
    """Tests for rhythm grid creation and retrieval."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('rguser', 'rg@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='BPM Video', owner=self.user,
            file='videos/bpm.mp4', duration=180.0,
            width=1920, height=1080, fps=30.0,
        )

    def test_create_rhythm_grid(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/videos/videos/{self.video.id}/create_rhythm_grid/',
            {'bpm': 120, 'time_signature_numerator': 4, 'time_signature_denominator': 4, 'offset_start': 0.5},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        rg = RhythmGrid.objects.get(video=self.video)
        self.assertAlmostEqual(rg.bpm, 120.0)
        self.assertAlmostEqual(rg.offset_start, 0.5)

    def test_update_rhythm_grid(self):
        """Creating rhythm grid again should update it, not duplicate."""
        RhythmGrid.objects.create(
            video=self.video, bpm=100.0,
            time_signature_numerator=4, time_signature_denominator=4,
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/videos/videos/{self.video.id}/create_rhythm_grid/',
            {'bpm': 140, 'time_signature_numerator': 3, 'time_signature_denominator': 4},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        rg = RhythmGrid.objects.get(video=self.video)
        self.assertAlmostEqual(rg.bpm, 140.0)
        self.assertEqual(rg.time_signature_numerator, 3)


class ExportStatusAPITests(TestCase):
    """Tests for export_status and export_download endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('expuser', 'exp@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Export Video', owner=self.user,
            file='videos/export.mp4', duration=60.0,
            width=1920, height=1080, fps=30.0,
        )

    def test_export_status_requires_job_id(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            f'/api/videos/videos/{self.video.id}/export_status/',
        )
        self.assertEqual(response.status_code, 400)

    def test_export_status_not_found(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            f'/api/videos/videos/{self.video.id}/export_status/?job_id=99999',
        )
        self.assertEqual(response.status_code, 404)

    def test_export_status_success(self):
        from billing.models import ExportJob
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            status='completed', resolution='1080p',
            credits_consumed=Decimal('2.00'),
            output_file_url='/tmp/test_output.mp4',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            f'/api/videos/videos/{self.video.id}/export_status/?job_id={job.id}',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'completed')
        self.assertTrue(data.get('download_ready'))

    def test_export_status_other_user_denied(self):
        from billing.models import ExportJob
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            status='completed', resolution='1080p',
        )

        other = User.objects.create_user('otherexp', 'other@test.com', 'pass1234')
        self.client.force_authenticate(user=other)
        response = self.client.get(
            f'/api/videos/videos/{self.video.id}/export_status/?job_id={job.id}',
        )
        self.assertEqual(response.status_code, 404)

    def test_export_download_not_ready(self):
        from billing.models import ExportJob
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            status='processing', resolution='1080p',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            f'/api/videos/videos/{self.video.id}/export_download/?job_id={job.id}',
        )
        self.assertEqual(response.status_code, 404)


class AnalyzeBpmAPITests(TestCase):
    """Tests for POST /api/videos/videos/{id}/analyze_bpm/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('bpmuser', 'bpm@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='BPM Test', owner=self.user,
            file='videos/bpm_test.mp4', duration=120.0,
        )

    @patch('videos.views.analyze_video_with_downbeat')
    def test_analyze_bpm_success(self, mock_analyze):
        mock_analyze.return_value = {
            'bpm': 128.0,
            'offset_start': 0.234,
            'beat_timestamps': [0.234, 0.703, 1.172],
            'beats_per_bar': 4,
            'time_signature_numerator': 4,
            'time_signature_denominator': 4,
            'confidence': 0.85,
        }

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/videos/videos/{self.video.id}/analyze_bpm/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertAlmostEqual(data['bpm'], 128.0)
        self.assertAlmostEqual(data['offset_start'], 0.234)

    def test_analyze_bpm_no_file(self):
        v = Video.objects.create(
            title='No File', owner=self.user,
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/videos/videos/{v.id}/analyze_bpm/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 400)


class FragmentAPITests(TestCase):
    """Tests for fragments CRUD."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('fraguser', 'frag@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Frag Video', owner=self.user,
            file='videos/frag.mp4', duration=300.0,
        )

    def test_list_fragments(self):
        Fragment.objects.create(
            video=self.video, name='Intro',
            bar_start=0, bar_end=4,
        )
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/videos/fragments/')
        self.assertEqual(response.status_code, 200)
