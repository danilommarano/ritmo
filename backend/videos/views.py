"""
API views for video management
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.http import FileResponse
from .models import Video, RhythmGrid, Fragment, VideoElement
from .serializers import (
    VideoSerializer,
    VideoListSerializer,
    RhythmGridSerializer,
    FragmentSerializer,
    VideoElementSerializer
)
from .video_processor import extract_video_metadata, export_video_with_counter, export_video_with_elements
from .audio_analyzer import analyze_video_with_downbeat, generate_waveform_data
import os
import math
from decimal import Decimal


class VideoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Video CRUD operations.
    Supports both authenticated users and anonymous sessions.
    """
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_queryset(self):
        """Filter videos by owner (authenticated) or session_key (anonymous)"""
        from django.db.models import Q
        
        user = self.request.user
        session_key = self.request.headers.get('X-Session-Key', '')
        
        if user.is_authenticated:
            # Authenticated: show owned videos + anonymous videos from their current session
            q = Q(owner=user)
            if session_key:
                q |= Q(session_key=session_key, owner__isnull=True)
            return Video.objects.filter(q)
        
        # Anonymous: filter by session key from header
        if session_key:
            return Video.objects.filter(session_key=session_key, owner__isnull=True)
        
        return Video.objects.none()
    
    def get_serializer_class(self):
        """Use different serializers for list and detail views"""
        if self.action == 'list':
            return VideoListSerializer
        return VideoSerializer
    
    def perform_create(self, serializer):
        """Set owner if authenticated, or session_key if anonymous. Check storage limits."""
        user = self.request.user
        
        # ── Billing: check storage limit before upload ──
        if user.is_authenticated:
            uploaded_file = self.request.FILES.get('file')
            file_size = uploaded_file.size if uploaded_file else 0
            
            if file_size > 0:
                try:
                    from billing.models import StorageUsage, StorageLimitExceededError
                    
                    storage, _ = StorageUsage.objects.get_or_create(user=user)
                    
                    # Get plan limit
                    try:
                        sub = user.subscription
                        if sub.is_active and not storage.has_space(file_size, sub.plan):
                            from rest_framework.exceptions import ValidationError
                            gb_used = storage.gb_used
                            gb_limit = sub.plan.storage_limit_gb
                            raise ValidationError({
                                'detail': f'Limite de storage atingido ({gb_used:.1f}/{gb_limit} GB). Faca upgrade do plano ou delete videos antigos.',
                                'storage_used_gb': round(gb_used, 2),
                                'storage_limit_gb': gb_limit,
                                'file_size_mb': round(file_size / (1024 * 1024), 1),
                            })
                    except user.subscription.RelatedObjectDoesNotExist:
                        pass  # No subscription, allow upload
                    except AttributeError:
                        pass  # No subscription relation
                except ImportError:
                    pass  # billing app not installed
            
            instance = serializer.save(owner=user)
            
            # ── Billing: track storage after successful save ──
            if instance.file and instance.file.size > 0:
                try:
                    from billing.models import StorageUsage
                    storage, _ = StorageUsage.objects.get_or_create(user=user)
                    storage.add_file(instance.file.size)
                except ImportError:
                    pass
        else:
            session_key = self.request.headers.get('X-Session-Key', '')
            if not session_key:
                import uuid
                session_key = str(uuid.uuid4())
            serializer.save(session_key=session_key)
    
    @action(detail=True, methods=['post'])
    def create_rhythm_grid(self, request, pk=None):
        """
        Create or update rhythm grid for a video.
        POST /api/videos/{id}/create_rhythm_grid/
        
        Body:
        {
            "bpm": 120,
            "time_signature_numerator": 4,
            "time_signature_denominator": 4,
            "offset_start": 0.5
        }
        """
        video = self.get_object()
        
        # Check if rhythm grid already exists
        try:
            rhythm_grid = video.rhythm_grid
            # Update existing
            serializer = RhythmGridSerializer(rhythm_grid, data=request.data, partial=True)
        except RhythmGrid.DoesNotExist:
            # Create new
            data = request.data.copy()
            data['video'] = video.id
            serializer = RhythmGridSerializer(data=data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def rhythm_grid(self, request, pk=None):
        """
        Get rhythm grid for a video.
        GET /api/videos/{id}/rhythm_grid/
        """
        video = self.get_object()
        try:
            rhythm_grid = video.rhythm_grid
            serializer = RhythmGridSerializer(rhythm_grid)
            return Response(serializer.data)
        except RhythmGrid.DoesNotExist:
            return Response(
                {'detail': 'Rhythm grid not found for this video'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def fragments(self, request, pk=None):
        """
        Get all fragments for a video.
        GET /api/videos/{id}/fragments/
        """
        video = self.get_object()
        fragments = video.fragments.all()
        serializer = FragmentSerializer(fragments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def create_fragment(self, request, pk=None):
        """
        Create a new fragment for a video.
        POST /api/videos/{id}/create_fragment/
        
        Body:
        {
            "bar_start": 0,
            "bar_end": 3,
            "name": "Introduction",
            "description": "Opening sequence",
            "tags": ["intro", "basic"],
            "color": "#FF5733"
        }
        """
        video = self.get_object()
        data = request.data.copy()
        data['video'] = video.id
        
        serializer = FragmentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def process_metadata(self, request, pk=None):
        """
        Extract and save video metadata (duration, fps, dimensions).
        POST /api/videos/{id}/process_metadata/
        """
        video = self.get_object()
        
        if not video.file:
            return Response(
                {'detail': 'Video file not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            metadata = extract_video_metadata(video.file.path)
            video.duration = metadata['duration']
            video.fps = metadata['fps']
            video.width = metadata['width']
            video.height = metadata['height']
            video.is_processed = True
            video.save()
            
            serializer = self.get_serializer(video)
            return Response(serializer.data)
        except Exception as e:
            video.processing_error = str(e)
            video.save()
            return Response(
                {'detail': f'Error processing video: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def export_with_counter(self, request, pk=None):
        """
        Export video with rhythm counter overlay.
        POST /api/videos/{id}/export_with_counter/
        
        Body:
        {
            "start_time": 0,
            "end_time": 60,
            "use_rhythm_grid": true
        }
        """
        video = self.get_object()
        
        if not video.file:
            return Response(
                {'detail': 'Video file not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        start_time = float(request.data.get('start_time', 0))
        end_time = request.data.get('end_time')
        if end_time:
            end_time = float(end_time)
        else:
            end_time = video.duration
        
        use_rhythm_grid = request.data.get('use_rhythm_grid', True)
        
        try:
            rhythm_grid = None
            if use_rhythm_grid:
                try:
                    rhythm_grid = video.rhythm_grid
                except RhythmGrid.DoesNotExist:
                    return Response(
                        {'detail': 'Rhythm grid not found. Create one first.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            output_path = export_video_with_counter(
                video.file.path,
                start_time,
                end_time,
                rhythm_grid
            )
            
            # Return the file
            response = FileResponse(
                open(output_path, 'rb'),
                content_type='video/mp4'
            )
            response['Content-Disposition'] = f'attachment; filename="{video.title}_with_counter.mp4"'
            return response
            
        except Exception as e:
            return Response(
                {'detail': f'Error exporting video: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def analyze_bpm(self, request, pk=None):
        """
        Analyze video audio to detect BPM and first downbeat.
        POST /api/videos/{id}/analyze_bpm/
        
        Body (optional):
        {
            "bpm": 120,  // Optional: if provided, will use this BPM instead of auto-detecting
            "beats_per_bar": 4,  // Optional: default 4
            "search_seconds": 25  // Optional: how many seconds to search for downbeat
        }
        
        Returns:
        {
            "bpm": 120.5,
            "offset_start": 0.234,
            "beat_timestamps": [0.234, 0.734, ...],
            "beats_per_bar": 4,
            "time_signature_numerator": 4,
            "time_signature_denominator": 4
        }
        """
        video = self.get_object()
        
        if not video.file:
            return Response(
                {'detail': 'Video file not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        bpm = request.data.get('bpm')
        if bpm:
            bpm = float(bpm)
        beats_per_bar = int(request.data.get('beats_per_bar', 4))
        search_seconds = int(request.data.get('search_seconds', 25))
        
        try:
            result = analyze_video_with_downbeat(
                video.file.path,
                bpm=bpm,
                beats_per_bar=beats_per_bar,
                search_seconds=search_seconds
            )
            return Response(result)
        except Exception as e:
            return Response(
                {'detail': f'Error analyzing video: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def waveform(self, request, pk=None):
        """
        Get waveform visualization data for a video.
        GET /api/videos/{id}/waveform/?samples=500
        
        Returns:
        {
            "data": [0.1, 0.3, 0.8, ...],  // Normalized amplitude values (0-1)
            "duration": 120.5
        }
        """
        video = self.get_object()
        
        if not video.file:
            return Response(
                {'detail': 'Video file not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        num_samples = int(request.query_params.get('samples', 1000))
        
        try:
            waveform_data = generate_waveform_data(video.file.path, num_samples=num_samples)
            return Response({
                'data': waveform_data,
                'duration': video.duration
            })
        except Exception as e:
            return Response(
                {'detail': f'Error generating waveform: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get', 'post'])
    def elements(self, request, pk=None):
        """
        Get or save video elements.
        GET /api/videos/{id}/elements/ - Get all elements for this video
        POST /api/videos/{id}/elements/ - Save elements (replaces all existing)
        
        POST Body:
        {
            "elements": [
                {
                    "type": "text",
                    "startTime": 0,
                    "endTime": 10,
                    "x": 50,
                    "y": 50,
                    "visible": true,
                    "content": "Hello",
                    "fontSize": 32,
                    ...
                },
                ...
            ]
        }
        """
        video = self.get_object()
        
        if request.method == 'GET':
            elements = video.elements.all()
            return Response([el.to_dict() for el in elements])
        
        elif request.method == 'POST':
            elements_data = request.data.get('elements', [])
            
            # Delete existing elements
            video.elements.all().delete()
            
            # Create new elements
            created_elements = []
            for el_data in elements_data:
                # Extract common fields
                element = VideoElement(
                    video=video,
                    element_type=el_data.get('type', 'text'),
                    start_time=el_data.get('startTime', 0),
                    end_time=el_data.get('endTime', video.duration or 0),
                    x=el_data.get('x', 50),
                    y=el_data.get('y', 50),
                    visible=el_data.get('visible', True),
                )
                
                # Store all other properties in the properties JSON field
                properties = {}
                skip_keys = {'id', 'type', 'startTime', 'endTime', 'x', 'y', 'visible'}
                for key, value in el_data.items():
                    if key not in skip_keys:
                        properties[key] = value
                
                element.properties = properties
                element.save()
                created_elements.append(element.to_dict())
            
            return Response({
                'message': f'Saved {len(created_elements)} elements',
                'elements': created_elements
            })
    
    @action(detail=True, methods=['post'])
    def export_with_elements(self, request, pk=None):
        """
        Export video with visual elements (text, counters, alerts) rendered on top.
        POST /api/videos/{id}/export_with_elements/
        
        Body:
        {
            "elements": [
                {
                    "type": "text",
                    "content": "Hello",
                    "startTime": 0,
                    "endTime": 10,
                    "x": 50,
                    "y": 50,
                    "fontSize": 32,
                    "fontColor": "white",
                    "hasBackground": true,
                    "backgroundColor": "rgba(0,0,0,0.5)"
                },
                ...
            ],
            "start_time": 0,
            "end_time": 120
        }
        """
        video = self.get_object()
        
        if not video.file:
            return Response(
                {'detail': 'Video file not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        elements = request.data.get('elements', [])
        start_time = float(request.data.get('start_time', 0))
        end_time = request.data.get('end_time')
        if end_time:
            end_time = float(end_time)
        else:
            end_time = video.duration
        
        # Get BPM config from request or from video's rhythm grid
        bpm_config = request.data.get('bpm_config', None)
        if not bpm_config:
            try:
                rhythm_grid = video.rhythm_grid
                bpm_config = {
                    'bpm': rhythm_grid.bpm,
                    'timeSignatureNum': rhythm_grid.time_signature_numerator,
                    'offsetStart': rhythm_grid.offset_start
                }
            except:
                bpm_config = {
                    'bpm': 120,
                    'timeSignatureNum': 4,
                    'offsetStart': 0
                }
        
        # Get video segments for cutting/duplicating
        video_segments = request.data.get('video_segments', None)
        
        # Get preview dimensions from frontend for proper scale calculation
        # This ensures elements appear the same size relative to video in export as in preview
        preview_width = request.data.get('preview_width')
        preview_height = request.data.get('preview_height')
        
        # ── Billing: reserve export credits ──
        export_job = None
        user = request.user
        if user.is_authenticated:
            try:
                from billing.models import CreditBalance, ExportJob, InsufficientCreditsError
                from django.db import transaction
                
                # Calculate duration in minutes (account for segments + speed)
                if video_segments and len(video_segments) > 0:
                    total_seconds = sum(
                        (seg.get('end_time', video.duration or 0) - seg.get('start_time', 0)) / max(seg.get('speed', 1.0), 0.1)
                        for seg in video_segments
                    )
                else:
                    total_seconds = (end_time or video.duration or 0) - start_time
                
                duration_minutes = Decimal(str(max(math.ceil(total_seconds / 60), 1)))
                
                # Determine resolution and multiplier
                resolution = '4k' if (video.height or 0) >= 2160 else '1080p'
                multiplier = Decimal('2.0') if resolution == '4k' else Decimal('1.0')
                credits_needed = duration_minutes * multiplier
                
                # Get export priority from subscription
                priority = 'normal'
                try:
                    sub = user.subscription
                    if sub.is_active:
                        priority = sub.plan.export_priority
                except Exception:
                    pass
                
                # Create export job
                export_job = ExportJob.objects.create(
                    user=user,
                    video=video,
                    status='pending',
                    resolution=resolution,
                    priority=priority,
                    estimated_duration_minutes=duration_minutes,
                    credit_multiplier=multiplier,
                    credits_consumed=credits_needed,
                )
                
                # Reserve credits atomically
                with transaction.atomic():
                    balance = CreditBalance.objects.select_for_update().filter(user=user).first()
                    if balance and balance.has_enough_credits(credits_needed):
                        balance.debit(
                            credits_needed,
                            description=f"Export video '{video.title}' ({resolution}, {duration_minutes}min)",
                            export_job=export_job,
                        )
                        export_job.status = 'reserved'
                        export_job.save(update_fields=['status'])
                    elif balance:
                        export_job.status = 'canceled'
                        export_job.error_message = 'Creditos insuficientes'
                        export_job.save(update_fields=['status', 'error_message'])
                        return Response(
                            {
                                'detail': 'Creditos insuficientes para exportar.',
                                'credits_needed': float(credits_needed),
                                'credits_available': float(balance.total_minutes),
                            },
                            status=status.HTTP_402_PAYMENT_REQUIRED,
                        )
                    # If no balance record exists, allow export (free tier / no billing setup)
            except ImportError:
                pass  # billing app not installed, skip
            except Exception as billing_err:
                import logging
                logging.getLogger(__name__).warning(f"Billing check skipped: {billing_err}")
        
        try:
            if export_job:
                from django.utils import timezone as tz
                export_job.status = 'processing'
                export_job.started_at = tz.now()
                export_job.save(update_fields=['status', 'started_at'])
            
            # Get video metadata
            video_metadata = {
                'width': video.width,
                'height': video.height,
                'duration': video.duration,
                'fps': video.fps
            }
            
            output_path = export_video_with_elements(
                video.file.path,
                elements,
                start_time=start_time,
                end_time=end_time,
                video_metadata=video_metadata,
                bpm_config=bpm_config,
                video_segments=video_segments,
                preview_width=preview_width,
                preview_height=preview_height
            )
            
            if export_job:
                from django.utils import timezone as tz
                export_job.status = 'completed'
                export_job.completed_at = tz.now()
                try:
                    export_job.output_file_size = os.path.getsize(output_path)
                except Exception:
                    pass
                export_job.save(update_fields=['status', 'completed_at', 'output_file_size'])
            
            # Return the file
            response = FileResponse(
                open(output_path, 'rb'),
                content_type='video/mp4'
            )
            response['Content-Disposition'] = f'attachment; filename="{video.title}_with_elements.mp4"'
            return response
            
        except Exception as e:
            # ── Billing: refund credits on failure ──
            if export_job and export_job.status in ('reserved', 'processing'):
                try:
                    from billing.models import CreditBalance, CreditTransaction
                    from django.db import transaction
                    with transaction.atomic():
                        balance = CreditBalance.objects.select_for_update().get(user=user)
                        refund_amount = export_job.credits_consumed
                        # Refund to subscription credits first (reverse of debit)
                        balance.subscription_minutes += refund_amount
                        balance.save(update_fields=['subscription_minutes', 'updated_at'])
                        CreditTransaction.objects.create(
                            user=user,
                            transaction_type='refund',
                            minutes=refund_amount,
                            balance_after=balance.total_minutes,
                            description=f"Refund: export failed - {str(e)[:100]}",
                            export_job=export_job,
                        )
                    export_job.status = 'failed'
                    export_job.error_message = str(e)[:500]
                    export_job.save(update_fields=['status', 'error_message'])
                except Exception as refund_err:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to refund credits: {refund_err}")
            
            return Response(
                {'detail': f'Error exporting video: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RhythmGridViewSet(viewsets.ModelViewSet):
    """
    ViewSet for RhythmGrid CRUD operations
    """
    queryset = RhythmGrid.objects.all()
    serializer_class = RhythmGridSerializer
    
    @action(detail=True, methods=['get'])
    def bar_info(self, request, pk=None):
        """
        Get information about a specific bar.
        GET /api/rhythm-grids/{id}/bar_info/?bar_index=5
        """
        rhythm_grid = self.get_object()
        bar_index = request.query_params.get('bar_index')
        
        if bar_index is None:
            return Response(
                {'detail': 'bar_index parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            bar_index = int(bar_index)
        except ValueError:
            return Response(
                {'detail': 'bar_index must be an integer'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        start_time, end_time = rhythm_grid.get_bar_time_range(bar_index)
        
        return Response({
            'bar_index': bar_index,
            'start_time': start_time,
            'end_time': end_time,
            'duration': end_time - start_time
        })


class FragmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Fragment CRUD operations
    """
    queryset = Fragment.objects.all()
    serializer_class = FragmentSerializer
    
    def get_queryset(self):
        """Filter fragments by video if video_id is provided"""
        queryset = Fragment.objects.all()
        video_id = self.request.query_params.get('video_id')
        if video_id:
            queryset = queryset.filter(video_id=video_id)
        return queryset
