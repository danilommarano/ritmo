"""
Billing URL configuration.
"""
from django.urls import path
from . import views

urlpatterns = [
    # Public
    path('plans/', views.list_plans, name='billing-plans'),

    # User billing info
    path('status/', views.billing_status, name='billing-status'),
    path('export-history/', views.export_history, name='export-history'),

    # Checkout
    path('checkout/', views.create_checkout, name='billing-checkout'),
    path('purchase-credits/', views.create_credit_purchase, name='purchase-credits'),

    # Subscription management
    path('change-plan/', views.change_plan, name='change-plan'),
    path('cancel/', views.cancel_sub, name='cancel-subscription'),
    path('reactivate/', views.reactivate_sub, name='reactivate-subscription'),
    path('portal/', views.billing_portal, name='billing-portal'),

    # Stripe webhook (no auth - verified by signature)
    path('webhook/stripe/', views.stripe_webhook, name='stripe-webhook'),
]
