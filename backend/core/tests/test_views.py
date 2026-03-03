"""
Tests for core views: auth_status, current_user, claim_anonymous_videos.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from videos.models import Video


class AuthStatusTests(TestCase):
    """Tests for GET /api/auth/status/"""

    def setUp(self):
        self.client = APIClient()

    def test_anonymous_returns_false(self):
        response = self.client.get('/api/auth/status/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data['authenticated'])

    def test_authenticated_returns_true(self):
        user = User.objects.create_user('authuser', 'auth@test.com', 'pass1234')
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/auth/status/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['authenticated'])
        self.assertEqual(data['user']['email'], 'auth@test.com')


class CurrentUserTests(TestCase):
    """Tests for GET /api/auth/user/ (served by dj-rest-auth UserDetailsView)"""

    def setUp(self):
        self.client = APIClient()

    def test_unauthenticated_returns_401(self):
        response = self.client.get('/api/auth/user/')
        self.assertEqual(response.status_code, 401)

    def test_returns_user_info(self):
        user = User.objects.create_user('meuser', 'me@test.com', 'pass1234')

        self.client.force_authenticate(user=user)
        response = self.client.get('/api/auth/user/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['email'], 'me@test.com')


class ClaimAnonymousVideosTests(TestCase):
    """Tests for POST /api/auth/claim-videos/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('claimuser', 'claim@test.com', 'pass1234')

    def test_unauthenticated_returns_401(self):
        response = self.client.post(
            '/api/auth/claim-videos/',
            {'session_key': 'abc'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

    def test_missing_session_key(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/auth/claim-videos/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_claim_no_videos_found(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/auth/claim-videos/',
            {'session_key': 'nonexistent'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['claimed'], 0)

    def test_claim_transfers_videos(self):
        v1 = Video.objects.create(
            title='Anon1', session_key='sess-claim-test',
            file='a.mp4', duration=60.0,
        )
        v2 = Video.objects.create(
            title='Anon2', session_key='sess-claim-test',
            file='b.mp4', duration=30.0,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/auth/claim-videos/',
            {'session_key': 'sess-claim-test'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['claimed'], 2)

        v1.refresh_from_db()
        v2.refresh_from_db()
        self.assertEqual(v1.owner, self.user)
        self.assertEqual(v2.owner, self.user)
        self.assertIsNone(v1.session_key)

    def test_does_not_claim_already_owned(self):
        """Videos already owned by another user should not be claimed."""
        other = User.objects.create_user('otheruser', 'other@test.com', 'pass1234')
        Video.objects.create(
            title='Owned', owner=other, session_key='sess-owned',
            file='c.mp4',
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            '/api/auth/claim-videos/',
            {'session_key': 'sess-owned'},
            format='json',
        )
        self.assertEqual(response.json()['claimed'], 0)
