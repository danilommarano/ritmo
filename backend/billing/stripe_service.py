"""
Stripe integration service for Ritmo billing.

Handles:
- Customer creation
- Checkout session creation
- Subscription management (upgrade/downgrade/cancel)
- Webhook processing
- Credit purchase one-time payments
- Billing portal sessions
"""
import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from datetime import datetime

from .models import (
    Plan, Subscription, CreditBalance, StorageUsage,
    ExportJob, CreditTransaction,
    InsufficientCreditsError, StorageLimitExceededError,
)


def _init_stripe():
    stripe.api_key = settings.STRIPE_SECRET_KEY


# ──────────────────────────────────────────────
# Customer
# ──────────────────────────────────────────────

def get_or_create_stripe_customer(user):
    """Get existing Stripe customer or create a new one."""
    _init_stripe()

    # Check if user already has a subscription with a customer ID
    sub = getattr(user, 'subscription', None)
    if sub and sub.stripe_customer_id:
        return sub.stripe_customer_id

    # Search by email
    customers = stripe.Customer.list(email=user.email, limit=1)
    if customers.data:
        return customers.data[0].id

    # Create new customer
    customer = stripe.Customer.create(
        email=user.email,
        name=getattr(user, 'get_full_name', lambda: user.username)(),
        metadata={'user_id': str(user.id)},
    )
    return customer.id


# ──────────────────────────────────────────────
# Checkout Session (new subscription)
# ──────────────────────────────────────────────

def create_checkout_session(user, plan, success_url, cancel_url):
    """
    Create a Stripe Checkout Session for a new subscription.
    Returns the session URL to redirect the user to.
    """
    _init_stripe()
    customer_id = get_or_create_stripe_customer(user)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=['card'],
        line_items=[{
            'price': plan.stripe_price_id,
            'quantity': 1,
        }],
        mode='subscription',
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'user_id': str(user.id),
            'plan_slug': plan.slug,
        },
        subscription_data={
            'metadata': {
                'user_id': str(user.id),
                'plan_slug': plan.slug,
            },
        },
        locale='pt-BR',
        currency='brl',
    )
    return session


# ──────────────────────────────────────────────
# Credit Purchase (one-time payment)
# ──────────────────────────────────────────────

def create_credit_purchase_session(user, minutes, price_per_minute_brl, success_url, cancel_url):
    """
    Create a Stripe Checkout Session for purchasing extra credit minutes.
    These credits NEVER expire.
    """
    _init_stripe()
    customer_id = get_or_create_stripe_customer(user)

    amount_cents = int(minutes * float(price_per_minute_brl) * 100)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': 'brl',
                'product_data': {
                    'name': f'{minutes} minutos de exportacao extra',
                    'description': 'Creditos de exportacao que nunca expiram',
                },
                'unit_amount': amount_cents,
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'user_id': str(user.id),
            'credit_minutes': str(minutes),
            'type': 'credit_purchase',
        },
        locale='pt-BR',
    )
    return session


# ──────────────────────────────────────────────
# Subscription Management
# ──────────────────────────────────────────────

def change_subscription_plan(subscription, new_plan):
    """
    Upgrade or downgrade a subscription.
    Stripe handles prorating automatically.
    """
    _init_stripe()

    stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)

    stripe.Subscription.modify(
        subscription.stripe_subscription_id,
        items=[{
            'id': stripe_sub['items']['data'][0].id,
            'price': new_plan.stripe_price_id,
        }],
        proration_behavior='create_prorations',
        metadata={
            'user_id': str(subscription.user_id),
            'plan_slug': new_plan.slug,
        },
    )

    # Local update happens via webhook (customer.subscription.updated)
    return True


def cancel_subscription(subscription, at_period_end=True):
    """
    Cancel a subscription. Default: cancel at end of billing period.
    """
    _init_stripe()

    if at_period_end:
        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=True,
        )
        subscription.cancel_at_period_end = True
        subscription.save(update_fields=['cancel_at_period_end', 'updated_at'])
    else:
        stripe.Subscription.cancel(subscription.stripe_subscription_id)
        subscription.status = 'canceled'
        subscription.canceled_at = timezone.now()
        subscription.save(update_fields=['status', 'canceled_at', 'updated_at'])

    return True


def reactivate_subscription(subscription):
    """
    Reactivate a subscription that was set to cancel at period end.
    """
    _init_stripe()

    if not subscription.cancel_at_period_end:
        return False

    stripe.Subscription.modify(
        subscription.stripe_subscription_id,
        cancel_at_period_end=False,
    )
    subscription.cancel_at_period_end = False
    subscription.canceled_at = None
    subscription.save(update_fields=['cancel_at_period_end', 'canceled_at', 'updated_at'])
    return True


# ──────────────────────────────────────────────
# Billing Portal
# ──────────────────────────────────────────────

def create_billing_portal_session(user, return_url):
    """
    Create a Stripe Billing Portal session for the user to manage
    payment methods, view invoices, etc.
    """
    _init_stripe()
    customer_id = get_or_create_stripe_customer(user)

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session


# ──────────────────────────────────────────────
# Export Credit Control (race-condition safe)
# ──────────────────────────────────────────────

@transaction.atomic
def reserve_export_credits(user, video, duration_minutes, resolution='1080p'):
    """
    Reserve credits for an export BEFORE processing begins.
    Uses SELECT FOR UPDATE to prevent race conditions.

    Returns (ExportJob, CreditTransaction) or raises InsufficientCreditsError.
    """
    # Determine multiplier
    multiplier = 2.0 if resolution == '4k' else 1.0
    effective_minutes = duration_minutes * multiplier

    # Lock the credit balance row
    balance = CreditBalance.objects.select_for_update().get(user=user)

    if not balance.has_enough_credits(effective_minutes):
        raise InsufficientCreditsError(
            f"Creditos insuficientes. Necessario: {effective_minutes:.1f} min, "
            f"disponivel: {balance.total_minutes:.1f} min"
        )

    # Determine priority from subscription
    priority = 'normal'
    sub = getattr(user, 'subscription', None)
    if sub and sub.is_active:
        priority = sub.plan.export_priority

    # Create export job
    export_job = ExportJob.objects.create(
        user=user,
        video=video,
        status='reserved',
        resolution=resolution,
        priority=priority,
        estimated_duration_minutes=duration_minutes,
        credits_consumed=effective_minutes,
        credit_multiplier=multiplier,
    )

    # Debit credits
    tx = balance.debit(
        minutes=effective_minutes,
        description=f"Export #{export_job.id}: {duration_minutes:.1f}min @ {resolution} (x{multiplier})",
        export_job=export_job,
    )

    return export_job, tx


@transaction.atomic
def refund_export_credits(export_job):
    """
    Refund credits if an export fails. Returns credits to subscription pool first.
    """
    if export_job.status not in ('reserved', 'processing', 'failed'):
        return False

    balance = CreditBalance.objects.select_for_update().get(user=export_job.user)

    minutes = export_job.credits_consumed

    sub = getattr(export_job.user, 'subscription', None)
    plan_limit = sub.plan.export_minutes_per_month if sub and sub.is_active else 0

    # How much can go back to subscription credits
    sub_space = max(0, plan_limit - balance.subscription_minutes)
    sub_refund = min(minutes, sub_space)
    purchased_refund = minutes - sub_refund

    balance.subscription_minutes += sub_refund
    balance.purchased_minutes += purchased_refund
    balance.save(update_fields=['subscription_minutes', 'purchased_minutes', 'updated_at'])

    CreditTransaction.objects.create(
        user=export_job.user,
        transaction_type='refund',
        minutes=minutes,
        balance_after=balance.total_minutes,
        description=f"Refund for failed export #{export_job.id}",
        export_job=export_job,
    )

    export_job.status = 'failed'
    export_job.save(update_fields=['status', 'updated_at'])
    return True


# ──────────────────────────────────────────────
# Storage Control
# ──────────────────────────────────────────────

def check_storage_limit(user, file_size_bytes):
    """
    Check if user can upload a file. Raises StorageLimitExceededError if not.
    """
    sub = getattr(user, 'subscription', None)
    if not sub or not sub.is_active:
        raise StorageLimitExceededError("Assinatura ativa necessaria para upload.")

    storage, _ = StorageUsage.objects.get_or_create(user=user)

    if not storage.has_space(file_size_bytes, sub.plan):
        gb_used = storage.gb_used
        gb_limit = sub.plan.storage_limit_gb
        raise StorageLimitExceededError(
            f"Limite de armazenamento atingido. "
            f"Usando {gb_used:.1f}GB de {gb_limit}GB. "
            f"Faca upgrade do plano ou delete videos antigos."
        )

    return True


# ──────────────────────────────────────────────
# Webhook Handlers
# ──────────────────────────────────────────────

def handle_checkout_completed(session):
    """Handle checkout.session.completed webhook."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    metadata = session.get('metadata', {})
    user_id = metadata.get('user_id')

    if not user_id:
        return

    user = User.objects.get(id=int(user_id))

    # Credit purchase
    if metadata.get('type') == 'credit_purchase':
        minutes = int(metadata.get('credit_minutes', 0))
        if minutes > 0:
            balance, _ = CreditBalance.objects.get_or_create(user=user)
            balance.add_purchased_credits(
                minutes=minutes,
                stripe_payment_intent_id=session.get('payment_intent', ''),
            )
        return

    # Subscription checkout is handled by invoice.paid webhook


def handle_invoice_paid(invoice):
    """
    Handle invoice.paid webhook.
    This is the KEY event for subscription lifecycle:
    - First payment: create Subscription + CreditBalance + StorageUsage
    - Renewal: reset subscription credits
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    stripe_sub_id = invoice.get('subscription')
    customer_id = invoice.get('customer')

    if not stripe_sub_id:
        return

    _init_stripe()
    stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
    metadata = stripe_sub.get('metadata', {})
    user_id = metadata.get('user_id')
    plan_slug = metadata.get('plan_slug')

    if not user_id or not plan_slug:
        return

    user = User.objects.get(id=int(user_id))
    plan = Plan.objects.get(slug=plan_slug)

    period_start = datetime.fromtimestamp(
        stripe_sub['current_period_start'], tz=timezone.utc
    )
    period_end = datetime.fromtimestamp(
        stripe_sub['current_period_end'], tz=timezone.utc
    )

    with transaction.atomic():
        # Create or update subscription
        sub, created = Subscription.objects.update_or_create(
            user=user,
            defaults={
                'plan': plan,
                'status': stripe_sub['status'],
                'stripe_subscription_id': stripe_sub_id,
                'stripe_customer_id': customer_id,
                'current_period_start': period_start,
                'current_period_end': period_end,
                'cancel_at_period_end': stripe_sub.get('cancel_at_period_end', False),
            },
        )

        # Create or get credit balance and reset
        balance, _ = CreditBalance.objects.get_or_create(user=user)
        balance.reset_subscription_credits(plan.export_minutes_per_month)

        # Ensure storage usage exists
        StorageUsage.objects.get_or_create(user=user)


def handle_invoice_payment_failed(invoice):
    """
    Handle invoice.payment_failed webhook.
    Mark subscription as past_due. Stripe will retry automatically.
    """
    stripe_sub_id = invoice.get('subscription')
    if not stripe_sub_id:
        return

    try:
        sub = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        sub.status = 'past_due'
        sub.save(update_fields=['status', 'updated_at'])
    except Subscription.DoesNotExist:
        pass


def handle_subscription_updated(stripe_sub):
    """Handle customer.subscription.updated webhook."""
    stripe_sub_id = stripe_sub['id']
    metadata = stripe_sub.get('metadata', {})
    plan_slug = metadata.get('plan_slug')

    try:
        sub = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
    except Subscription.DoesNotExist:
        return

    sub.status = stripe_sub['status']
    sub.cancel_at_period_end = stripe_sub.get('cancel_at_period_end', False)

    if stripe_sub.get('canceled_at'):
        sub.canceled_at = datetime.fromtimestamp(
            stripe_sub['canceled_at'], tz=timezone.utc
        )

    period_start = datetime.fromtimestamp(
        stripe_sub['current_period_start'], tz=timezone.utc
    )
    period_end = datetime.fromtimestamp(
        stripe_sub['current_period_end'], tz=timezone.utc
    )
    sub.current_period_start = period_start
    sub.current_period_end = period_end

    # Plan change (upgrade/downgrade)
    if plan_slug:
        try:
            new_plan = Plan.objects.get(slug=plan_slug)
            if sub.plan_id != new_plan.id:
                sub.plan = new_plan
                # On upgrade: immediately give new plan's credits if more
                balance, _ = CreditBalance.objects.get_or_create(user=sub.user)
                if new_plan.export_minutes_per_month > balance.subscription_minutes:
                    balance.reset_subscription_credits(new_plan.export_minutes_per_month)
        except Plan.DoesNotExist:
            pass

    sub.save()


def handle_subscription_deleted(stripe_sub):
    """Handle customer.subscription.deleted webhook (subscription fully canceled)."""
    stripe_sub_id = stripe_sub['id']

    try:
        sub = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
        sub.status = 'canceled'
        sub.canceled_at = timezone.now()
        sub.save(update_fields=['status', 'canceled_at', 'updated_at'])

        # Zero out subscription credits (purchased credits remain!)
        balance, _ = CreditBalance.objects.get_or_create(user=sub.user)
        balance.subscription_minutes = 0
        balance.save(update_fields=['subscription_minutes', 'updated_at'])
    except Subscription.DoesNotExist:
        pass
