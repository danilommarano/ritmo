"""
Tests for billing API endpoints.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from billing.models import (
    Plan, Subscription, CreditBalance, StorageUsage, ExportJob,
)
from videos.models import Video


class BillingStatusAPITests(TestCase):
    """Tests for GET /api/billing/status/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('apiuser', 'api@test.com', 'pass1234')
        self.plan = Plan.objects.create(
            slug='pro', name='Pro', price_brl=Decimal('59.90'),
            storage_limit_gb=20, export_minutes_per_month=120,
            export_priority='normal',
        )

    def test_unauthenticated_returns_401(self):
        response = self.client.get('/api/billing/status/')
        self.assertEqual(response.status_code, 401)

    def test_authenticated_no_subscription(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/billing/status/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('credits', data)
        self.assertIn('storage', data)

    def test_authenticated_with_subscription(self):
        Subscription.objects.create(
            user=self.user, plan=self.plan,
            status='active',
            stripe_subscription_id='sub_test_api',
            stripe_customer_id='cus_test_api',
        )
        CreditBalance.objects.create(
            user=self.user,
            subscription_minutes=Decimal('100.00'),
            purchased_minutes=Decimal('20.00'),
        )
        StorageUsage.objects.create(
            user=self.user, bytes_used=1024 * 1024 * 500, file_count=3,
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/billing/status/')
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn('subscription', data)
        self.assertIn('credits', data)
        self.assertIn('storage', data)


class PlansAPITests(TestCase):
    """Tests for GET /api/billing/plans/"""

    def setUp(self):
        self.client = APIClient()
        Plan.objects.create(
            slug='basic', name='Basic', price_brl=Decimal('29.90'),
            storage_limit_gb=5, export_minutes_per_month=30,
            export_priority='low', display_order=1,
        )
        Plan.objects.create(
            slug='pro', name='Pro', price_brl=Decimal('59.90'),
            storage_limit_gb=20, export_minutes_per_month=120,
            export_priority='normal', display_order=2,
        )

    def test_list_plans_anonymous(self):
        response = self.client.get('/api/billing/plans/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)

    def test_plans_ordered_by_display_order(self):
        response = self.client.get('/api/billing/plans/')
        data = response.json()
        self.assertEqual(data[0]['slug'], 'basic')
        self.assertEqual(data[1]['slug'], 'pro')


class ExportHistoryAPITests(TestCase):
    """Tests for GET /api/billing/export-history/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('histuser', 'hist@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Test Video', owner=self.user,
            file='videos/test.mp4', duration=60.0,
        )

    def test_unauthenticated(self):
        response = self.client.get('/api/billing/export-history/')
        self.assertEqual(response.status_code, 401)

    def test_empty_history(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/billing/export-history/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 0)

    def test_history_returns_own_jobs(self):
        ExportJob.objects.create(
            user=self.user, video=self.video,
            status='completed', resolution='1080p',
            credits_consumed=Decimal('2.00'),
        )
        other_user = User.objects.create_user('other', 'other@test.com', 'pass1234')
        ExportJob.objects.create(
            user=other_user, video=self.video,
            status='completed', resolution='4k',
            credits_consumed=Decimal('4.00'),
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/billing/export-history/')
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['resolution'], '1080p')
