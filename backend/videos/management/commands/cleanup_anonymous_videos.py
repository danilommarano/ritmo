"""
Management command to clean up anonymous videos that were never claimed.
Run periodically via cron or celery beat.
Usage: python manage.py cleanup_anonymous_videos
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from datetime import timedelta
from videos.models import Video


class Command(BaseCommand):
    help = 'Delete anonymous videos older than ANONYMOUS_SESSION_EXPIRY_HOURS that were never claimed by a user.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=None,
            help='Override expiry hours (default: ANONYMOUS_SESSION_EXPIRY_HOURS from settings)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        hours = options['hours'] or getattr(settings, 'ANONYMOUS_SESSION_EXPIRY_HOURS', 72)
        dry_run = options['dry_run']
        
        cutoff = timezone.now() - timedelta(hours=hours)
        
        expired_videos = Video.objects.filter(
            owner__isnull=True,
            session_key__isnull=False,
            created_at__lt=cutoff,
        )
        
        count = expired_videos.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No expired anonymous videos found.'))
            return
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f'[DRY RUN] Would delete {count} anonymous video(s) older than {hours} hours:'
            ))
            for video in expired_videos[:20]:
                self.stdout.write(f'  - {video.id}: "{video.title}" (session: {video.session_key}, created: {video.created_at})')
            if count > 20:
                self.stdout.write(f'  ... and {count - 20} more')
        else:
            # Delete files from storage first
            for video in expired_videos:
                if video.file:
                    try:
                        video.file.delete(save=False)
                    except Exception as e:
                        self.stderr.write(f'Error deleting file for video {video.id}: {e}')
                if video.thumbnail:
                    try:
                        video.thumbnail.delete(save=False)
                    except Exception as e:
                        self.stderr.write(f'Error deleting thumbnail for video {video.id}: {e}')
            
            expired_videos.delete()
            self.stdout.write(self.style.SUCCESS(
                f'Deleted {count} anonymous video(s) older than {hours} hours.'
            ))
