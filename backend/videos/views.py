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


class VideoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Video CRUD operations
    """
    queryset = Video.objects.all()
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_serializer_class(self):
        """Use different serializers for list and detail views"""
        if self.action == 'list':
            return VideoListSerializer
        return VideoSerializer
    
    def perform_create(self, serializer):
        """Set the owner to the current user"""
        # For now, using first user. TODO: Implement authentication
        from django.contrib.auth.models import User
        user = User.objects.first()
        if not user:
            user = User.objects.create_user(username='default_user')
        serializer.save(owner=user)
    
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
        
        try:
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
                video_segments=video_segments
            )
            
            # Return the file
            response = FileResponse(
                open(output_path, 'rb'),
                content_type='video/mp4'
            )
            response['Content-Disposition'] = f'attachment; filename="{video.title}_with_elements.mp4"'
            return response
            
        except Exception as e:
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
