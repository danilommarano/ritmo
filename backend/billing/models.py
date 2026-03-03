"""
Billing models for Ritmo SaaS.

Key design decisions:
- CreditBalance uses select_for_update() to prevent race conditions on debit
- Plan minutes are "subscription credits" that reset each billing cycle
- Purchased credits (add-ons) are stored separately and NEVER expire
- Storage is tracked per-video and enforced on upload
- 4K exports consume 2x credit minutes
"""
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone
from core.models import TimeStampedModel


class Plan(TimeStampedModel):
    """
    Subscription plan definition.
    Mirrors Stripe Product + Price.
    """
    PLAN_BASIC = 'basic'
    PLAN_PRO = 'pro'
    PLAN_CREATOR = 'creator'
    PLAN_CHOICES = [
        (PLAN_BASIC, 'Basic'),
        (PLAN_PRO, 'Pro'),
        (PLAN_CREATOR, 'Creator'),
    ]

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=50)
    price_brl = models.DecimalField(max_digits=8, decimal_places=2)

    # Stripe IDs
    stripe_product_id = models.CharField(max_length=128, blank=True)
    stripe_price_id = models.CharField(max_length=128, blank=True)

    # Limits
    storage_limit_gb = models.IntegerField(help_text="Max storage in GB")
    export_minutes_per_month = models.IntegerField(help_text="Monthly export minutes included")
    max_resolution = models.CharField(
        max_length=10,
        default='1080p',
        help_text="Max export resolution (1080p, 4k)"
    )
    export_priority = models.CharField(
        max_length=10,
        default='normal',
        choices=[('low', 'Low'), ('normal', 'Normal'), ('high', 'High')],
    )
    auto_delete_days = models.IntegerField(
        default=7,
        help_text="Days before inactive projects are auto-deleted"
    )

    # Feature flags
    allows_4k = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['display_order', 'price_brl']

    def __str__(self):
        return f"{self.name} (R${self.price_brl}/mes)"

    @property
    def storage_limit_bytes(self):
        return self.storage_limit_gb * 1024 * 1024 * 1024


class Subscription(TimeStampedModel):
    """
    User's active subscription. 1:1 with User (only one active sub at a time).
    Maps to a Stripe Subscription.
    """
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('past_due', 'Past Due'),
        ('canceled', 'Canceled'),
        ('unpaid', 'Unpaid'),
        ('trialing', 'Trialing'),
        ('incomplete', 'Incomplete'),
        ('incomplete_expired', 'Incomplete Expired'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription'
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='incomplete')

    # Stripe IDs
    stripe_subscription_id = models.CharField(max_length=128, unique=True, db_index=True)
    stripe_customer_id = models.CharField(max_length=128, db_index=True)

    # Billing cycle
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    # Cancellation
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['stripe_customer_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user} -> {self.plan.name} ({self.status})"

    @property
    def is_active(self):
        return self.status in ('active', 'trialing')

    @property
    def is_past_due(self):
        return self.status == 'past_due'


class CreditBalance(TimeStampedModel):
    """
    User's export credit balance. Single row per user.
    Uses select_for_update() on every debit to prevent race conditions.

    Two separate balances:
    - subscription_minutes: reset each billing cycle, cannot carry over
    - purchased_minutes: bought separately, NEVER expire
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_balance'
    )

    subscription_minutes = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Remaining subscription minutes for current billing cycle"
    )

    purchased_minutes = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Purchased credit minutes (never expire)"
    )

    last_reset_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Credit balances"

    def __str__(self):
        total = self.total_minutes
        return f"{self.user}: {total} min ({self.subscription_minutes} sub + {self.purchased_minutes} purchased)"

    @property
    def total_minutes(self):
        return self.subscription_minutes + self.purchased_minutes

    def has_enough_credits(self, minutes_needed):
        """Check if user has enough combined credits."""
        return self.total_minutes >= minutes_needed

    @transaction.atomic
    def debit(self, minutes, description="", export_job=None):
        """
        Debit credits atomically. Uses subscription credits first, then purchased.
        Returns the CreditTransaction or raises InsufficientCreditsError.

        MUST be called within select_for_update() context:
            balance = CreditBalance.objects.select_for_update().get(user=user)
            balance.debit(minutes, ...)
        """
        if not self.has_enough_credits(minutes):
            raise InsufficientCreditsError(
                f"Need {minutes} min, have {self.total_minutes} min"
            )

        remaining = minutes
        sub_debited = min(self.subscription_minutes, remaining)
        self.subscription_minutes -= sub_debited
        remaining -= sub_debited

        if remaining > 0:
            self.purchased_minutes -= remaining

        self.save(update_fields=['subscription_minutes', 'purchased_minutes', 'updated_at'])

        tx = CreditTransaction.objects.create(
            user=self.user,
            transaction_type='debit',
            minutes=minutes,
            subscription_minutes_used=sub_debited,
            purchased_minutes_used=minutes - sub_debited,
            balance_after=self.total_minutes,
            description=description,
            export_job=export_job,
        )
        return tx

    @transaction.atomic
    def reset_subscription_credits(self, plan_minutes):
        """Reset subscription credits to plan allocation. Called on billing cycle reset."""
        old_balance = self.subscription_minutes
        self.subscription_minutes = plan_minutes
        self.last_reset_at = timezone.now()
        self.save(update_fields=['subscription_minutes', 'last_reset_at', 'updated_at'])

        CreditTransaction.objects.create(
            user=self.user,
            transaction_type='reset',
            minutes=plan_minutes,
            balance_after=self.total_minutes,
            description=f"Monthly reset: {old_balance} -> {plan_minutes} subscription minutes",
        )

    @transaction.atomic
    def add_purchased_credits(self, minutes, stripe_payment_intent_id=""):
        """Add purchased credits (never expire)."""
        self.purchased_minutes += minutes
        self.save(update_fields=['purchased_minutes', 'updated_at'])

        CreditTransaction.objects.create(
            user=self.user,
            transaction_type='purchase',
            minutes=minutes,
            balance_after=self.total_minutes,
            description=f"Purchased {minutes} minutes",
            stripe_payment_intent_id=stripe_payment_intent_id,
        )


class CreditTransaction(TimeStampedModel):
    """
    Immutable audit log of every credit change.
    """
    TRANSACTION_TYPES = [
        ('debit', 'Debit (export)'),
        ('reset', 'Monthly Reset'),
        ('purchase', 'Credit Purchase'),
        ('refund', 'Refund'),
        ('adjustment', 'Manual Adjustment'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_transactions'
    )
    transaction_type = models.CharField(max_length=16, choices=TRANSACTION_TYPES)
    minutes = models.DecimalField(max_digits=10, decimal_places=2)

    subscription_minutes_used = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    purchased_minutes_used = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    balance_after = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)

    export_job = models.ForeignKey(
        'ExportJob', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='credit_transactions'
    )
    stripe_payment_intent_id = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type']),
        ]

    def __str__(self):
        return f"{self.user} {self.transaction_type} {self.minutes}min @ {self.created_at}"


class StorageUsage(TimeStampedModel):
    """
    Tracks storage consumed per user. Updated on upload/delete.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='storage_usage'
    )
    bytes_used = models.BigIntegerField(default=0)
    file_count = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "Storage usage"

    def __str__(self):
        mb = self.bytes_used / (1024 * 1024)
        return f"{self.user}: {mb:.1f} MB ({self.file_count} files)"

    @property
    def gb_used(self):
        return self.bytes_used / (1024 * 1024 * 1024)

    def has_space(self, additional_bytes, plan):
        """Check if adding additional_bytes would exceed the plan limit."""
        return (self.bytes_used + additional_bytes) <= plan.storage_limit_bytes

    @transaction.atomic
    def add_file(self, file_size_bytes):
        """Track a new file upload."""
        self.bytes_used += file_size_bytes
        self.file_count += 1
        self.save(update_fields=['bytes_used', 'file_count', 'updated_at'])

    @transaction.atomic
    def remove_file(self, file_size_bytes):
        """Track a file deletion."""
        self.bytes_used = max(0, self.bytes_used - file_size_bytes)
        self.file_count = max(0, self.file_count - 1)
        self.save(update_fields=['bytes_used', 'file_count', 'updated_at'])


class ExportJob(TimeStampedModel):
    """
    Tracks every export request for billing and auditing.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reserved', 'Credits Reserved'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('canceled', 'Canceled'),
    ]
    RESOLUTION_CHOICES = [
        ('1080p', '1080p'),
        ('4k', '4K'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='export_jobs'
    )
    video = models.ForeignKey(
        'videos.Video',
        on_delete=models.CASCADE,
        related_name='export_jobs'
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    resolution = models.CharField(max_length=10, choices=RESOLUTION_CHOICES, default='1080p')
    priority = models.CharField(
        max_length=10,
        default='normal',
        choices=[('low', 'Low'), ('normal', 'Normal'), ('high', 'High')],
    )

    estimated_duration_minutes = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Estimated export duration in minutes"
    )
    credits_consumed = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Actual credits debited (after 4K multiplier)"
    )
    credit_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.00,
        help_text="1.0 for 1080p, 2.0 for 4K"
    )

    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    output_file_url = models.URLField(blank=True)
    output_file_size = models.BigIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"Export #{self.id} {self.user} ({self.status}) {self.resolution}"

    @property
    def effective_minutes(self):
        """Duration * multiplier (4K = 2x)."""
        return self.estimated_duration_minutes * self.credit_multiplier


class InsufficientCreditsError(Exception):
    """Raised when user doesn't have enough credits for an export."""
    pass


class StorageLimitExceededError(Exception):
    """Raised when upload would exceed plan storage limit."""
    pass
