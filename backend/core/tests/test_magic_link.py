"""
Tests for magic link (passwordless) email login.
"""
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient


class MagicLinkRequestTests(TestCase):
    """Tests for POST /api/auth/magic-link/request/"""

    def setUp(self):
        self.client = APIClient()

    def test_missing_email(self):
        response = self.client.post(
            '/api/auth/magic-link/request/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    @patch('core.magic_link.send_mail')
    def test_request_for_new_user(self, mock_send):
        response = self.client.post(
            '/api/auth/magic-link/request/',
            {'email': 'newuser@test.com'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('email', data)

    @patch('core.magic_link.send_mail')
    def test_request_for_existing_user(self, mock_send):
        User.objects.create_user('existing', 'existing@test.com', 'pass')
        response = self.client.post(
            '/api/auth/magic-link/request/',
            {'email': 'existing@test.com'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)


class MagicLinkVerifyTests(TestCase):
    """Tests for POST /api/auth/magic-link/verify/"""

    def setUp(self):
        self.client = APIClient()

    def test_missing_fields(self):
        response = self.client.post(
            '/api/auth/magic-link/verify/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_invalid_code(self):
        response = self.client.post(
            '/api/auth/magic-link/verify/',
            {'email': 'nobody@test.com', 'code': '000000'},
            format='json',
        )
        self.assertIn(response.status_code, [400, 401, 429])
