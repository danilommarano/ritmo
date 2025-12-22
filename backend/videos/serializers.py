"""
Serializers for video models
"""
from rest_framework import serializers
from .models import Video, RhythmGrid, Fragment


class RhythmGridSerializer(serializers.ModelSerializer):
    """Serializer for RhythmGrid model"""
    
    # Read-only calculated fields
    time_signature = serializers.ReadOnlyField()
    beats_per_bar = serializers.ReadOnlyField()
    beat_duration_ms = serializers.ReadOnlyField()
    bar_duration_ms = serializers.ReadOnlyField()
    beat_duration_seconds = serializers.ReadOnlyField()
    bar_duration_seconds = serializers.ReadOnlyField()
    total_bars = serializers.SerializerMethodField()
    
    class Meta:
        model = RhythmGrid
        fields = [
            'id',
            'video',
            'bpm',
            'time_signature_numerator',
            'time_signature_denominator',
            'time_signature',
            'offset_start',
            'beats_per_bar',
            'beat_duration_ms',
            'bar_duration_ms',
            'beat_duration_seconds',
            'bar_duration_seconds',
            'total_bars',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_total_bars(self, obj):
        """Get total number of bars in the video"""
        return obj.get_total_bars()


class FragmentSerializer(serializers.ModelSerializer):
    """Serializer for Fragment model"""
    
    duration_bars = serializers.ReadOnlyField()
    time_range = serializers.SerializerMethodField()
    
    class Meta:
        model = Fragment
        fields = [
            'id',
            'video',
            'bar_start',
            'bar_end',
            'name',
            'description',
            'tags',
            'color',
            'duration_bars',
            'time_range',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_time_range(self, obj):
        """Get time range in seconds for this fragment"""
        time_range = obj.get_time_range()
        if time_range:
            return {
                'start': time_range[0],
                'end': time_range[1]
            }
        return None
    
    def validate(self, data):
        """Validate that bar_end >= bar_start"""
        if data.get('bar_end', 0) < data.get('bar_start', 0):
            raise serializers.ValidationError(
                "bar_end must be greater than or equal to bar_start"
            )
        return data


class VideoSerializer(serializers.ModelSerializer):
    """Serializer for Video model"""
    
    owner_username = serializers.ReadOnlyField(source='owner.username')
    file_url = serializers.SerializerMethodField()
    rhythm_grid = RhythmGridSerializer(read_only=True)
    fragments = FragmentSerializer(many=True, read_only=True)
    fragments_count = serializers.SerializerMethodField()
    
    def get_file_url(self, obj):
        """Get URL for the video file"""
        if obj.file:
            # Return relative URL - the frontend proxy will handle it
            return obj.file.url
        return None
    
    class Meta:
        model = Video
        fields = [
            'id',
            'owner',
            'owner_username',
            'title',
            'description',
            'file',
            'file_url',
            'thumbnail',
            'duration',
            'fps',
            'width',
            'height',
            'is_processed',
            'processing_error',
            'rhythm_grid',
            'fragments',
            'fragments_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'owner',
            'duration',
            'fps',
            'width',
            'height',
            'is_processed',
            'processing_error',
            'created_at',
            'updated_at',
        ]
    
    def get_fragments_count(self, obj):
        """Get total number of fragments for this video"""
        return obj.fragments.count()


class VideoListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for video list view"""
    
    owner_username = serializers.ReadOnlyField(source='owner.username')
    file_url = serializers.SerializerMethodField()
    has_rhythm_grid = serializers.SerializerMethodField()
    fragments_count = serializers.SerializerMethodField()
    
    def get_file_url(self, obj):
        """Get URL for the video file"""
        if obj.file:
            # Return relative URL - the frontend proxy will handle it
            return obj.file.url
        return None
    
    class Meta:
        model = Video
        fields = [
            'id',
            'owner_username',
            'title',
            'description',
            'file_url',
            'thumbnail',
            'duration',
            'is_processed',
            'has_rhythm_grid',
            'fragments_count',
            'created_at',
        ]
    
    def get_has_rhythm_grid(self, obj):
        """Check if video has a rhythm grid"""
        return hasattr(obj, 'rhythm_grid')
    
    def get_fragments_count(self, obj):
        """Get total number of fragments for this video"""
        return obj.fragments.count()
