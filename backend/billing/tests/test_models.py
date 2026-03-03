"""
Tests for billing models: Plan, CreditBalance, StorageUsage, ExportJob.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from billing.models import (
    Plan, Subscription, CreditBalance, CreditTransaction,
    StorageUsage, ExportJob, InsufficientCreditsError,
)
from videos.models import Video


class PlanModelTests(TestCase):
    def setUp(self):
        self.plan = Plan.objects.create(
            slug='basic', name='Basic', price_brl=Decimal('29.90'),
            storage_limit_gb=5, export_minutes_per_month=30,
            max_resolution='1080p', export_priority='low',
        )

    def test_str(self):
        self.assertIn('Basic', str(self.plan))
        self.assertIn('29.90', str(self.plan))

    def test_storage_limit_bytes(self):
        self.assertEqual(self.plan.storage_limit_bytes, 5 * 1024 * 1024 * 1024)


class CreditBalanceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('testuser', 'test@test.com', 'pass1234')
        self.balance = CreditBalance.objects.create(
            user=self.user,
            subscription_minutes=Decimal('30.00'),
            purchased_minutes=Decimal('10.00'),
        )

    def test_total_minutes(self):
        self.assertEqual(self.balance.total_minutes, Decimal('40.00'))

    def test_has_enough_credits_true(self):
        self.assertTrue(self.balance.has_enough_credits(Decimal('40.00')))

    def test_has_enough_credits_false(self):
        self.assertFalse(self.balance.has_enough_credits(Decimal('40.01')))

    def test_debit_uses_subscription_first(self):
        """Debit should consume subscription minutes before purchased."""
        tx = self.balance.debit(Decimal('20.00'), description='test debit')
        self.balance.refresh_from_db()

        self.assertEqual(self.balance.subscription_minutes, Decimal('10.00'))
        self.assertEqual(self.balance.purchased_minutes, Decimal('10.00'))
        self.assertEqual(tx.transaction_type, 'debit')
        self.assertEqual(tx.subscription_minutes_used, Decimal('20.00'))
        self.assertEqual(tx.purchased_minutes_used, Decimal('0.00'))
        self.assertEqual(tx.balance_after, Decimal('20.00'))

    def test_debit_overflows_to_purchased(self):
        """When subscription minutes run out, debit takes from purchased."""
        tx = self.balance.debit(Decimal('35.00'), description='overflow debit')
        self.balance.refresh_from_db()

        self.assertEqual(self.balance.subscription_minutes, Decimal('0.00'))
        self.assertEqual(self.balance.purchased_minutes, Decimal('5.00'))
        self.assertEqual(tx.subscription_minutes_used, Decimal('30.00'))
        self.assertEqual(tx.purchased_minutes_used, Decimal('5.00'))

    def test_debit_exact_total(self):
        """Debiting exactly total_minutes should leave balance at 0."""
        self.balance.debit(Decimal('40.00'))
        self.balance.refresh_from_db()

        self.assertEqual(self.balance.subscription_minutes, Decimal('0.00'))
        self.assertEqual(self.balance.purchased_minutes, Decimal('0.00'))

    def test_debit_insufficient_raises(self):
        """Debiting more than total_minutes raises InsufficientCreditsError."""
        with self.assertRaises(InsufficientCreditsError):
            self.balance.debit(Decimal('50.00'))

        # Balance should be unchanged
        self.balance.refresh_from_db()
        self.assertEqual(self.balance.total_minutes, Decimal('40.00'))

    def test_debit_creates_transaction(self):
        """Every debit should create an audit trail CreditTransaction."""
        self.balance.debit(Decimal('5.00'), description='audit test')
        txs = CreditTransaction.objects.filter(user=self.user, transaction_type='debit')
        self.assertEqual(txs.count(), 1)
        self.assertEqual(txs.first().minutes, Decimal('5.00'))

    def test_reset_subscription_credits(self):
        """Monthly reset replaces subscription_minutes with plan allocation."""
        self.balance.subscription_minutes = Decimal('2.00')
        self.balance.save()

        self.balance.reset_subscription_credits(Decimal('30.00'))
        self.balance.refresh_from_db()

        self.assertEqual(self.balance.subscription_minutes, Decimal('30.00'))
        self.assertEqual(self.balance.purchased_minutes, Decimal('10.00'))
        self.assertIsNotNone(self.balance.last_reset_at)

        # Should create a reset transaction
        txs = CreditTransaction.objects.filter(user=self.user, transaction_type='reset')
        self.assertEqual(txs.count(), 1)

    def test_add_purchased_credits(self):
        """Purchased credits should accumulate and never expire."""
        self.balance.add_purchased_credits(Decimal('20.00'))
        self.balance.refresh_from_db()

        self.assertEqual(self.balance.purchased_minutes, Decimal('30.00'))
        txs = CreditTransaction.objects.filter(user=self.user, transaction_type='purchase')
        self.assertEqual(txs.count(), 1)

    def test_multiple_debits_sequential(self):
        """Multiple debits in sequence should drain balance correctly."""
        self.balance.debit(Decimal('10.00'))
        self.balance.debit(Decimal('10.00'))
        self.balance.debit(Decimal('10.00'))
        self.balance.refresh_from_db()

        self.assertEqual(self.balance.total_minutes, Decimal('10.00'))

        txs = CreditTransaction.objects.filter(user=self.user, transaction_type='debit')
        self.assertEqual(txs.count(), 3)


class StorageUsageTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('storuser', 'stor@test.com', 'pass1234')
        self.plan = Plan.objects.create(
            slug='pro', name='Pro', price_brl=Decimal('59.90'),
            storage_limit_gb=20, export_minutes_per_month=120,
        )
        self.storage = StorageUsage.objects.create(user=self.user)

    def test_initial_state(self):
        self.assertEqual(self.storage.bytes_used, 0)
        self.assertEqual(self.storage.file_count, 0)
        self.assertEqual(self.storage.gb_used, 0.0)

    def test_add_file(self):
        self.storage.add_file(1024 * 1024 * 100)  # 100 MB
        self.storage.refresh_from_db()

        self.assertEqual(self.storage.bytes_used, 104857600)
        self.assertEqual(self.storage.file_count, 1)

    def test_remove_file(self):
        self.storage.add_file(1024 * 1024 * 200)
        self.storage.remove_file(1024 * 1024 * 50)
        self.storage.refresh_from_db()

        self.assertEqual(self.storage.file_count, 0)
        self.assertEqual(self.storage.bytes_used, 1024 * 1024 * 150)

    def test_remove_file_no_negative(self):
        """Removing more than exists should floor at 0."""
        self.storage.add_file(100)
        self.storage.remove_file(200)
        self.storage.refresh_from_db()

        self.assertEqual(self.storage.bytes_used, 0)
        self.assertEqual(self.storage.file_count, 0)

    def test_has_space_true(self):
        self.assertTrue(self.storage.has_space(1024, self.plan))

    def test_has_space_false(self):
        # Fill up storage
        self.storage.bytes_used = self.plan.storage_limit_bytes
        self.storage.save()
        self.assertFalse(self.storage.has_space(1, self.plan))

    def test_has_space_exactly_at_limit(self):
        self.storage.bytes_used = self.plan.storage_limit_bytes - 100
        self.storage.save()
        self.assertTrue(self.storage.has_space(100, self.plan))
        self.assertFalse(self.storage.has_space(101, self.plan))


class ExportJobTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('expuser', 'exp@test.com', 'pass1234')
        self.video = Video.objects.create(
            title='Test Video', owner=self.user,
            file='videos/test.mp4', duration=120.0,
            width=1920, height=1080, fps=30.0,
        )

    def test_create_export_job(self):
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            status='pending', resolution='1080p',
            priority='normal',
            estimated_duration_minutes=Decimal('2.00'),
            credits_consumed=Decimal('2.00'),
        )
        self.assertEqual(str(job), f"Export #{job.id} {self.user} (pending) 1080p")

    def test_effective_minutes_1080p(self):
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            estimated_duration_minutes=Decimal('5.00'),
            credit_multiplier=Decimal('1.00'),
        )
        self.assertEqual(job.effective_minutes, Decimal('5.00'))

    def test_effective_minutes_4k(self):
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            estimated_duration_minutes=Decimal('5.00'),
            credit_multiplier=Decimal('2.00'),
            resolution='4k',
        )
        self.assertEqual(job.effective_minutes, Decimal('10.00'))

    def test_export_params_json(self):
        """export_params should store and retrieve JSON data."""
        params = {'elements': [{'type': 'text'}], 'start_time': 0, 'end_time': 60}
        job = ExportJob.objects.create(
            user=self.user, video=self.video,
            export_params=params,
        )
        job.refresh_from_db()
        self.assertEqual(job.export_params['start_time'], 0)
        self.assertEqual(len(job.export_params['elements']), 1)


class SubscriptionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('subuser', 'sub@test.com', 'pass1234')
        self.plan = Plan.objects.create(
            slug='creator', name='Creator', price_brl=Decimal('99.90'),
            storage_limit_gb=50, export_minutes_per_month=300,
            export_priority='high', allows_4k=True,
        )

    def test_is_active_for_active_status(self):
        sub = Subscription.objects.create(
            user=self.user, plan=self.plan,
            status='active',
            stripe_subscription_id='sub_test1',
            stripe_customer_id='cus_test1',
        )
        self.assertTrue(sub.is_active)

    def test_is_active_for_trialing(self):
        sub = Subscription.objects.create(
            user=self.user, plan=self.plan,
            status='trialing',
            stripe_subscription_id='sub_test2',
            stripe_customer_id='cus_test2',
        )
        self.assertTrue(sub.is_active)

    def test_is_not_active_for_canceled(self):
        sub = Subscription.objects.create(
            user=self.user, plan=self.plan,
            status='canceled',
            stripe_subscription_id='sub_test3',
            stripe_customer_id='cus_test3',
        )
        self.assertFalse(sub.is_active)

    def test_is_past_due(self):
        sub = Subscription.objects.create(
            user=self.user, plan=self.plan,
            status='past_due',
            stripe_subscription_id='sub_test4',
            stripe_customer_id='cus_test4',
        )
        self.assertTrue(sub.is_past_due)
        self.assertFalse(sub.is_active)
