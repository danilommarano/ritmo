"""
Celery tasks for async video export.

Priority routing:
  - Creator plan → export_high queue
  - Pro plan     → export_normal queue
  - Basic plan   → export_low queue
"""
import os
import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

PRIORITY_QUEUE_MAP = {
    'high': 'export_high',
    'normal': 'export_normal',
    'low': 'export_low',
}


@shared_task(bind=True, max_retries=1, acks_late=True)
def run_export(self, export_job_id):
    """
    Process a video export asynchronously.

    Reads all parameters from the ExportJob record so that the task
    is fully self-contained and serialisable as JSON.
    """
    from billing.models import ExportJob, CreditBalance, CreditTransaction
    from django.db import transaction

    try:
        job = ExportJob.objects.select_related('video', 'user').get(id=export_job_id)
    except ExportJob.DoesNotExist:
        logger.error(f"ExportJob {export_job_id} not found")
        return {'status': 'error', 'detail': 'Job not found'}

    if job.status not in ('reserved', 'pending'):
        logger.warning(f"ExportJob {export_job_id} has unexpected status: {job.status}")
        return {'status': 'skipped', 'detail': f'Job status is {job.status}'}

    video = job.video

    # Mark as processing
    job.status = 'processing'
    job.started_at = timezone.now()
    job.save(update_fields=['status', 'started_at'])

    try:
        from .video_processor import export_video_with_elements

        # Retrieve stored export params from job metadata
        params = job.export_params or {}

        output_path = export_video_with_elements(
            video.file.path,
            params.get('elements', []),
            start_time=params.get('start_time', 0),
            end_time=params.get('end_time'),
            video_metadata=params.get('video_metadata'),
            bpm_config=params.get('bpm_config'),
            video_segments=params.get('video_segments'),
            preview_width=params.get('preview_width'),
            preview_height=params.get('preview_height'),
        )

        # Mark completed
        job.status = 'completed'
        job.completed_at = timezone.now()
        try:
            job.output_file_size = os.path.getsize(output_path)
        except Exception:
            pass
        # Store output path so the download endpoint can find it
        job.output_file_url = output_path
        job.save(update_fields=['status', 'completed_at', 'output_file_size', 'output_file_url'])

        logger.info(f"ExportJob {export_job_id} completed: {output_path}")
        return {'status': 'completed', 'output_path': output_path}

    except Exception as e:
        logger.error(f"ExportJob {export_job_id} failed: {e}", exc_info=True)

        # Refund credits
        try:
            with transaction.atomic():
                balance = CreditBalance.objects.select_for_update().get(user=job.user)
                refund_amount = job.credits_consumed
                balance.subscription_minutes += refund_amount
                balance.save(update_fields=['subscription_minutes', 'updated_at'])
                CreditTransaction.objects.create(
                    user=job.user,
                    transaction_type='refund',
                    minutes=refund_amount,
                    balance_after=balance.total_minutes,
                    description=f"Refund: async export failed - {str(e)[:100]}",
                    export_job=job,
                )
        except Exception as refund_err:
            logger.error(f"Failed to refund credits for job {export_job_id}: {refund_err}")

        job.status = 'failed'
        job.error_message = str(e)[:500]
        job.save(update_fields=['status', 'error_message'])

        return {'status': 'failed', 'detail': str(e)[:200]}
