"""
Video models - Core entities based on the planning document
"""
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, FileExtensionValidator
from core.models import TimeStampedModel
import os


def video_upload_path(instance, filename):
    """Generate upload path for video files"""
    return f'videos/{instance.owner.id}/{filename}'


class Video(TimeStampedModel):
    """
    Represents the base video file.
    
    Fields based on planning:
    - id (auto)
    - owner_id
    - duration
    - fps
    - file_url
    - created_at (from TimeStampedModel)
    """
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='videos'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # File information
    file = models.FileField(
        upload_to=video_upload_path,
        validators=[FileExtensionValidator(
            allowed_extensions=['mp4', 'avi', 'mov', 'mkv', 'webm']
        )]
    )
    thumbnail = models.ImageField(
        upload_to='thumbnails/',
        blank=True,
        null=True
    )
    
    # Video metadata (extracted after upload)
    duration = models.FloatField(
        null=True,
        blank=True,
        help_text="Duration in seconds"
    )
    fps = models.FloatField(
        null=True,
        blank=True,
        help_text="Frames per second"
    )
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    
    # Processing status
    is_processed = models.BooleanField(default=False)
    processing_error = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['owner', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} ({self.owner.username})"
    
    @property
    def file_url(self):
        """Returns the URL of the video file"""
        if self.file:
            return self.file.url
        return None


class RhythmGrid(TimeStampedModel):
    """
    Defines how time is organized in a video.
    This is the heart of the Ritmo system.
    
    Fields based on planning:
    - video_id
    - bpm
    - time_signature_numerator
    - time_signature_denominator
    - offset_start (timestamp of beat 1)
    - beats_per_bar (derived)
    - beat_duration_ms
    - bar_duration_ms
    """
    video = models.OneToOneField(
        Video,
        on_delete=models.CASCADE,
        related_name='rhythm_grid'
    )
    
    # Rhythm parameters
    bpm = models.FloatField(
        validators=[MinValueValidator(1.0)],
        help_text="Beats per minute"
    )
    time_signature_numerator = models.IntegerField(
        default=4,
        validators=[MinValueValidator(1)],
        help_text="Top number of time signature (e.g., 4 in 4/4)"
    )
    time_signature_denominator = models.IntegerField(
        default=4,
        validators=[MinValueValidator(1)],
        help_text="Bottom number of time signature (e.g., 4 in 4/4)"
    )
    
    # Offset - where beat 1 starts in the video
    offset_start = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0)],
        help_text="Timestamp in seconds where beat 1 occurs"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['video']),
        ]
    
    def __str__(self):
        return f"Grid for {self.video.title} - {self.bpm} BPM ({self.time_signature})"
    
    @property
    def time_signature(self):
        """Returns time signature as string (e.g., '4/4')"""
        return f"{self.time_signature_numerator}/{self.time_signature_denominator}"
    
    @property
    def beats_per_bar(self):
        """Number of beats in each bar (compasso)"""
        return self.time_signature_numerator
    
    @property
    def beat_duration_ms(self):
        """Duration of one beat in milliseconds"""
        return (60.0 / self.bpm) * 1000
    
    @property
    def bar_duration_ms(self):
        """Duration of one bar (compasso) in milliseconds"""
        return self.beat_duration_ms * self.beats_per_bar
    
    @property
    def beat_duration_seconds(self):
        """Duration of one beat in seconds"""
        return 60.0 / self.bpm
    
    @property
    def bar_duration_seconds(self):
        """Duration of one bar (compasso) in seconds"""
        return self.beat_duration_seconds * self.beats_per_bar
    
    def get_bar_at_time(self, time_seconds):
        """
        Returns the bar index at a given time in seconds.
        Returns None if time is before offset_start.
        """
        if time_seconds < self.offset_start:
            return None
        
        elapsed = time_seconds - self.offset_start
        bar_index = int(elapsed / self.bar_duration_seconds)
        return bar_index
    
    def get_bar_time_range(self, bar_index):
        """
        Returns (start_time, end_time) in seconds for a given bar index.
        """
        start_time = self.offset_start + (bar_index * self.bar_duration_seconds)
        end_time = start_time + self.bar_duration_seconds
        return (start_time, end_time)
    
    def get_total_bars(self):
        """
        Returns total number of bars in the video.
        Returns None if video duration is not set.
        """
        if not self.video.duration:
            return None
        
        if self.video.duration < self.offset_start:
            return 0
        
        elapsed = self.video.duration - self.offset_start
        total_bars = int(elapsed / self.bar_duration_seconds)
        return total_bars


class Fragment(TimeStampedModel):
    """
    Pedagogical unit - a semantic clip for study.
    
    Fields based on planning:
    - video_id
    - bar_start
    - bar_end
    - name
    - description
    - tags[]
    - created_at (from TimeStampedModel)
    
    Note: Fragments are NOT physical cuts, they are semantic selections.
    """
    video = models.ForeignKey(
        Video,
        on_delete=models.CASCADE,
        related_name='fragments'
    )
    
    # Bar range (compasso range)
    bar_start = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text="Starting bar index (0-based)"
    )
    bar_end = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text="Ending bar index (inclusive)"
    )
    
    # Metadata
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="List of tags for classification"
    )
    
    # Optional color for UI
    color = models.CharField(
        max_length=7,
        blank=True,
        help_text="Hex color code (e.g., #FF5733)"
    )
    
    class Meta:
        ordering = ['bar_start']
        indexes = [
            models.Index(fields=['video', 'bar_start']),
        ]
    
    def __str__(self):
        return f"{self.name} (bars {self.bar_start}-{self.bar_end})"
    
    def clean(self):
        """Validate that bar_end >= bar_start"""
        from django.core.exceptions import ValidationError
        if self.bar_end < self.bar_start:
            raise ValidationError('bar_end must be greater than or equal to bar_start')
    
    @property
    def duration_bars(self):
        """Number of bars in this fragment"""
        return self.bar_end - self.bar_start + 1
    
    def get_time_range(self):
        """
        Returns (start_time, end_time) in seconds for this fragment.
        Returns None if video doesn't have a rhythm grid.
        """
        try:
            rhythm_grid = self.video.rhythm_grid
            start_time, _ = rhythm_grid.get_bar_time_range(self.bar_start)
            _, end_time = rhythm_grid.get_bar_time_range(self.bar_end)
            return (start_time, end_time)
        except RhythmGrid.DoesNotExist:
            return None
