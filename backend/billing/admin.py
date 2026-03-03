from django.contrib import admin
from .models import Plan, Subscription, CreditBalance, CreditTransaction, StorageUsage, ExportJob


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'price_brl', 'storage_limit_gb', 'export_minutes_per_month', 'allows_4k', 'is_active']
    list_filter = ['is_active', 'allows_4k']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end']
    list_filter = ['status', 'plan']
    search_fields = ['user__email', 'stripe_subscription_id', 'stripe_customer_id']


@admin.register(CreditBalance)
class CreditBalanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'subscription_minutes', 'purchased_minutes', 'total_minutes', 'last_reset_at']
    search_fields = ['user__email']

    def total_minutes(self, obj):
        return obj.total_minutes
    total_minutes.short_description = 'Total'


@admin.register(CreditTransaction)
class CreditTransactionAdmin(admin.ModelAdmin):
    list_display = ['user', 'transaction_type', 'minutes', 'balance_after', 'created_at']
    list_filter = ['transaction_type']
    search_fields = ['user__email']
    readonly_fields = ['user', 'transaction_type', 'minutes', 'subscription_minutes_used',
                       'purchased_minutes_used', 'balance_after', 'description', 'export_job',
                       'stripe_payment_intent_id', 'created_at']


@admin.register(StorageUsage)
class StorageUsageAdmin(admin.ModelAdmin):
    list_display = ['user', 'bytes_used', 'gb_used', 'file_count']
    search_fields = ['user__email']

    def gb_used(self, obj):
        return f"{obj.gb_used:.2f} GB"
    gb_used.short_description = 'GB Used'


@admin.register(ExportJob)
class ExportJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'video', 'status', 'resolution', 'credits_consumed', 'created_at']
    list_filter = ['status', 'resolution']
    search_fields = ['user__email']
