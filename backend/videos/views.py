"""
API views for video management
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from .models import Video, RhythmGrid, Fragment
from .serializers import (
    VideoSerializer,
    VideoListSerializer,
    RhythmGridSerializer,
    FragmentSerializer
)


class VideoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Video CRUD operations
    """
    queryset = Video.objects.all()
    parser_classes = (MultiPartParser, FormParser)
    
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
