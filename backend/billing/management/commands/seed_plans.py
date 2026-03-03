"""
Management command to seed billing plans.
Run: python manage.py seed_plans
"""
from django.core.management.base import BaseCommand
from billing.models import Plan


PLANS = [
    {
        'slug': 'basic',
        'name': 'Basic',
        'price_brl': 15.00,
        'storage_limit_gb': 5,
        'export_minutes_per_month': 60,
        'max_resolution': '1080p',
        'allows_4k': False,
        'export_priority': 'low',
        'auto_delete_days': 7,
        'display_order': 1,
    },
    {
        'slug': 'pro',
        'name': 'Pro',
        'price_brl': 35.00,
        'storage_limit_gb': 30,
        'export_minutes_per_month': 200,
        'max_resolution': '4k',
        'allows_4k': True,
        'export_priority': 'normal',
        'auto_delete_days': 15,
        'display_order': 2,
    },
    {
        'slug': 'creator',
        'name': 'Creator',
        'price_brl': 60.00,
        'storage_limit_gb': 100,
        'export_minutes_per_month': 600,
        'max_resolution': '4k',
        'allows_4k': True,
        'export_priority': 'high',
        'auto_delete_days': 30,
        'display_order': 3,
    },
]


class Command(BaseCommand):
    help = 'Seed billing plans (Basic, Pro, Creator)'

    def handle(self, *args, **options):
        for plan_data in PLANS:
            plan, created = Plan.objects.update_or_create(
                slug=plan_data['slug'],
                defaults=plan_data,
            )
            action = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(
                f"{action} plan: {plan.name} - R${plan.price_brl}/mes"
            ))

        self.stdout.write(self.style.SUCCESS(f"\nTotal plans: {Plan.objects.count()}"))
