"""
Tests for video models: Video, RhythmGrid, Fragment.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from videos.models import Video, RhythmGrid, Fragment


class VideoModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('viduser', 'vid@test.com', 'pass1234')

    def test_create_video_with_owner(self):
        v = Video.objects.create(
            title='Dance Class', owner=self.user,
            file='videos/test.mp4', duration=120.0,
            width=1920, height=1080, fps=30.0,
        )
        self.assertIn('Dance Class', str(v))
        self.assertIn(self.user.username, str(v))
        self.assertEqual(v.file_url, '/media/videos/test.mp4')

    def test_create_anonymous_video(self):
        v = Video.objects.create(
            title='Anon Video',
            session_key='abc-123',
            file='videos/anonymous/abc-123/test.mp4',
            duration=60.0,
        )
        self.assertIn('anonymous', str(v))
        self.assertIsNone(v.owner)

    def test_ordering(self):
        Video.objects.create(title='First', owner=self.user, file='a.mp4')
        Video.objects.create(title='Second', owner=self.user, file='b.mp4')
        videos = list(Video.objects.all())
        # Ordered by -created_at so Second should come first
        self.assertEqual(videos[0].title, 'Second')


class RhythmGridModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('rguser', 'rg@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Samba', owner=self.user,
            file='videos/samba.mp4', duration=180.0,
            width=1920, height=1080, fps=30.0,
        )

    def test_create_rhythm_grid(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=120.0,
            time_signature_numerator=4,
            time_signature_denominator=4,
            offset_start=0.5,
        )
        self.assertEqual(rg.time_signature, '4/4')
        self.assertEqual(rg.beats_per_bar, 4)

    def test_beat_duration(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=120.0,
            time_signature_numerator=4,
            time_signature_denominator=4,
        )
        self.assertAlmostEqual(rg.beat_duration_seconds, 0.5)
        self.assertAlmostEqual(rg.beat_duration_ms, 500.0)

    def test_bar_duration(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=120.0,
            time_signature_numerator=4,
            time_signature_denominator=4,
        )
        self.assertAlmostEqual(rg.bar_duration_seconds, 2.0)
        self.assertAlmostEqual(rg.bar_duration_ms, 2000.0)

    def test_get_bar_at_time(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=120.0,
            time_signature_numerator=4,
            time_signature_denominator=4,
            offset_start=1.0,
        )
        # Before offset
        self.assertIsNone(rg.get_bar_at_time(0.5))
        # At offset (bar 0)
        self.assertEqual(rg.get_bar_at_time(1.0), 0)
        # Bar 1 starts at 3.0 seconds (offset 1.0 + bar_duration 2.0)
        self.assertEqual(rg.get_bar_at_time(3.0), 1)
        # Bar 5 starts at 11.0 seconds
        self.assertEqual(rg.get_bar_at_time(11.5), 5)

    def test_get_bar_time_range(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=120.0,
            time_signature_numerator=4,
            time_signature_denominator=4,
            offset_start=0.0,
        )
        start, end = rg.get_bar_time_range(0)
        self.assertAlmostEqual(start, 0.0)
        self.assertAlmostEqual(end, 2.0)

        start, end = rg.get_bar_time_range(3)
        self.assertAlmostEqual(start, 6.0)
        self.assertAlmostEqual(end, 8.0)

    def test_get_total_bars(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=120.0,
            time_signature_numerator=4,
            time_signature_denominator=4,
            offset_start=0.0,
        )
        # 180 seconds / 2 seconds per bar = 90 bars
        self.assertEqual(rg.get_total_bars(), 90)

    def test_waltz_time_signature(self):
        rg = RhythmGrid.objects.create(
            video=self.video, bpm=90.0,
            time_signature_numerator=3,
            time_signature_denominator=4,
        )
        self.assertEqual(rg.beats_per_bar, 3)
        self.assertEqual(rg.time_signature, '3/4')
        # Beat duration: 60/90 = 0.666... seconds
        # Bar duration: 0.666... * 3 = 2.0 seconds
        self.assertAlmostEqual(rg.bar_duration_seconds, 2.0)


class FragmentModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('fraguser', 'frag@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Practice', owner=self.user,
            file='videos/practice.mp4', duration=300.0,
        )

    def test_create_fragment(self):
        f = Fragment.objects.create(
            video=self.video, name='Chorus',
            bar_start=8, bar_end=16,
            description='Main chorus section',
        )
        self.assertIn('Chorus', str(f))
        self.assertEqual(f.bar_start, 8)
        self.assertEqual(f.bar_end, 16)
