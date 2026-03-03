"""
Billing API views for Ritmo.
"""
import json
import stripe
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import (
    Plan, Subscription, CreditBalance, StorageUsage, ExportJob,
    InsufficientCreditsError,
)
from . import stripe_service


# ──────────────────────────────────────────────
# Plans (public)
# ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def list_plans(request):
    """List all active plans."""
    plans = Plan.objects.filter(is_active=True).order_by('display_order')
    data = []
    for plan in plans:
        data.append({
            'slug': plan.slug,
            'name': plan.name,
            'price_brl': str(plan.price_brl),
            'storage_limit_gb': plan.storage_limit_gb,
            'export_minutes_per_month': plan.export_minutes_per_month,
            'max_resolution': plan.max_resolution,
            'allows_4k': plan.allows_4k,
            'export_priority': plan.export_priority,
            'auto_delete_days': plan.auto_delete_days,
        })
    return Response(data)


# ──────────────────────────────────────────────
# User billing status
# ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_status(request):
    """Get current user's billing status: subscription, credits, storage."""
    user = request.user

    # Subscription
    sub_data = None
    try:
        sub = user.subscription
        sub_data = {
            'plan_slug': sub.plan.slug,
            'plan_name': sub.plan.name,
            'status': sub.status,
            'is_active': sub.is_active,
            'current_period_start': sub.current_period_start,
            'current_period_end': sub.current_period_end,
            'cancel_at_period_end': sub.cancel_at_period_end,
            'plan_limits': {
                'storage_gb': sub.plan.storage_limit_gb,
                'export_minutes': sub.plan.export_minutes_per_month,
                'max_resolution': sub.plan.max_resolution,
                'allows_4k': sub.plan.allows_4k,
                'auto_delete_days': sub.plan.auto_delete_days,
            },
        }
    except Subscription.DoesNotExist:
        pass

    # Credits
    credit_data = {'subscription_minutes': 0, 'purchased_minutes': 0, 'total_minutes': 0}
    try:
        balance = user.credit_balance
        credit_data = {
            'subscription_minutes': float(balance.subscription_minutes),
            'purchased_minutes': float(balance.purchased_minutes),
            'total_minutes': float(balance.total_minutes),
            'last_reset_at': balance.last_reset_at,
        }
    except CreditBalance.DoesNotExist:
        pass

    # Storage
    storage_data = {'bytes_used': 0, 'gb_used': 0, 'file_count': 0}
    try:
        storage = user.storage_usage
        storage_data = {
            'bytes_used': storage.bytes_used,
            'gb_used': round(storage.gb_used, 2),
            'file_count': storage.file_count,
        }
    except StorageUsage.DoesNotExist:
        pass

    return Response({
        'subscription': sub_data,
        'credits': credit_data,
        'storage': storage_data,
    })


# ──────────────────────────────────────────────
# Checkout
# ──────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_checkout(request):
    """Create a Stripe Checkout session for a subscription."""
    plan_slug = request.data.get('plan_slug')
    if not plan_slug:
        return Response({'error': 'plan_slug is required'}, status=400)

    try:
        plan = Plan.objects.get(slug=plan_slug, is_active=True)
    except Plan.DoesNotExist:
        return Response({'error': 'Plan not found'}, status=404)

    # Check if already subscribed
    try:
        existing_sub = request.user.subscription
        if existing_sub.is_active:
            return Response(
                {'error': 'Voce ja possui uma assinatura ativa. Use upgrade/downgrade.'},
                status=400,
            )
    except Subscription.DoesNotExist:
        pass

    base_url = request.build_absolute_uri('/')[:-1]
    session = stripe_service.create_checkout_session(
        user=request.user,
        plan=plan,
        success_url=f"{base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/billing/cancel",
    )

    return Response({'checkout_url': session.url, 'session_id': session.id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_credit_purchase(request):
    """Create a Stripe Checkout session for purchasing extra credits."""
    minutes = request.data.get('minutes')
    if not minutes or int(minutes) <= 0:
        return Response({'error': 'minutes must be a positive integer'}, status=400)

    minutes = int(minutes)

    # Price per extra minute: R$0.50
    price_per_minute = 0.50

    base_url = request.build_absolute_uri('/')[:-1]
    session = stripe_service.create_credit_purchase_session(
        user=request.user,
        minutes=minutes,
        price_per_minute_brl=price_per_minute,
        success_url=f"{base_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{base_url}/billing/cancel",
    )

    return Response({
        'checkout_url': session.url,
        'session_id': session.id,
        'total_brl': f"{minutes * price_per_minute:.2f}",
    })


# ──────────────────────────────────────────────
# Subscription Management
# ──────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_plan(request):
    """Upgrade or downgrade the subscription plan."""
    new_plan_slug = request.data.get('plan_slug')
    if not new_plan_slug:
        return Response({'error': 'plan_slug is required'}, status=400)

    try:
        new_plan = Plan.objects.get(slug=new_plan_slug, is_active=True)
    except Plan.DoesNotExist:
        return Response({'error': 'Plan not found'}, status=404)

    try:
        sub = request.user.subscription
    except Subscription.DoesNotExist:
        return Response({'error': 'Nenhuma assinatura encontrada'}, status=404)

    if not sub.is_active:
        return Response({'error': 'Assinatura nao esta ativa'}, status=400)

    if sub.plan.slug == new_plan_slug:
        return Response({'error': 'Voce ja esta neste plano'}, status=400)

    try:
        stripe_service.change_subscription_plan(sub, new_plan)
        direction = 'upgrade' if new_plan.price_brl > sub.plan.price_brl else 'downgrade'
        return Response({
            'message': f'Plano alterado com sucesso ({direction})',
            'new_plan': new_plan.slug,
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_sub(request):
    """Cancel subscription at end of billing period."""
    try:
        sub = request.user.subscription
    except Subscription.DoesNotExist:
        return Response({'error': 'Nenhuma assinatura encontrada'}, status=404)

    at_period_end = request.data.get('at_period_end', True)
    stripe_service.cancel_subscription(sub, at_period_end=at_period_end)

    return Response({
        'message': 'Assinatura cancelada. Acesso ate o fim do periodo atual.',
        'cancel_at_period_end': sub.cancel_at_period_end,
        'current_period_end': sub.current_period_end,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reactivate_sub(request):
    """Reactivate a subscription that was set to cancel."""
    try:
        sub = request.user.subscription
    except Subscription.DoesNotExist:
        return Response({'error': 'Nenhuma assinatura encontrada'}, status=404)

    if stripe_service.reactivate_subscription(sub):
        return Response({'message': 'Assinatura reativada com sucesso!'})
    else:
        return Response({'error': 'Assinatura nao pode ser reativada'}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def billing_portal(request):
    """Create a Stripe Billing Portal session."""
    base_url = request.build_absolute_uri('/')[:-1]
    session = stripe_service.create_billing_portal_session(
        user=request.user,
        return_url=f"{base_url}/billing",
    )
    return Response({'portal_url': session.url})


# ──────────────────────────────────────────────
# Usage history
# ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_history(request):
    """Get user's export job history."""
    jobs = ExportJob.objects.filter(user=request.user).order_by('-created_at')[:50]
    data = []
    for job in jobs:
        data.append({
            'id': job.id,
            'video_id': job.video_id,
            'status': job.status,
            'resolution': job.resolution,
            'estimated_duration_minutes': float(job.estimated_duration_minutes),
            'credits_consumed': float(job.credits_consumed),
            'credit_multiplier': float(job.credit_multiplier),
            'created_at': job.created_at,
            'completed_at': job.completed_at,
        })
    return Response(data)


# ──────────────────────────────────────────────
# Stripe Webhook
# ──────────────────────────────────────────────

@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Stripe webhook endpoint. Verifies signature and dispatches events.

    Required events to configure in Stripe Dashboard:
    - checkout.session.completed
    - invoice.paid
    - invoice.payment_failed
    - customer.subscription.updated
    - customer.subscription.deleted
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    webhook_secret = settings.STRIPE_WEBHOOK_SECRET

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        return HttpResponse('Invalid payload', status=400)
    except stripe.error.SignatureVerificationError:
        return HttpResponse('Invalid signature', status=400)

    event_type = event['type']
    data = event['data']['object']

    handlers = {
        'checkout.session.completed': stripe_service.handle_checkout_completed,
        'invoice.paid': stripe_service.handle_invoice_paid,
        'invoice.payment_failed': stripe_service.handle_invoice_payment_failed,
        'customer.subscription.updated': stripe_service.handle_subscription_updated,
        'customer.subscription.deleted': stripe_service.handle_subscription_deleted,
    }

    handler = handlers.get(event_type)
    if handler:
        try:
            handler(data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Webhook handler error for {event_type}: {e}", exc_info=True)
            # Return 200 to prevent Stripe from retrying (we logged the error)
            return HttpResponse(status=200)

    return HttpResponse(status=200)
