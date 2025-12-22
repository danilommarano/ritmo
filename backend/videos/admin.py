"""
Admin configuration for video models
"""
from django.contrib import admin
from .models import Video, RhythmGrid, Fragment


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ['title', 'owner', 'duration', 'fps', 'is_processed', 'created_at']
    list_filter = ['is_processed', 'created_at']
    search_fields = ['title', 'description', 'owner__username']
    readonly_fields = ['duration', 'fps', 'width', 'height', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('owner', 'title', 'description', 'file', 'thumbnail')
        }),
        ('Video Metadata', {
            'fields': ('duration', 'fps', 'width', 'height')
        }),
        ('Processing Status', {
            'fields': ('is_processed', 'processing_error')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RhythmGrid)
class RhythmGridAdmin(admin.ModelAdmin):
    list_display = ['video', 'bpm', 'time_signature', 'offset_start', 'created_at']
    list_filter = ['time_signature_numerator', 'time_signature_denominator']
    search_fields = ['video__title']
    readonly_fields = ['created_at', 'updated_at', 'beats_per_bar', 'beat_duration_ms', 
                      'bar_duration_ms', 'beat_duration_seconds', 'bar_duration_seconds']
    
    fieldsets = (
        ('Video', {
            'fields': ('video',)
        }),
        ('Rhythm Parameters', {
            'fields': ('bpm', 'time_signature_numerator', 'time_signature_denominator', 'offset_start')
        }),
        ('Calculated Values', {
            'fields': ('beats_per_bar', 'beat_duration_ms', 'bar_duration_ms', 
                      'beat_duration_seconds', 'bar_duration_seconds'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Fragment)
class FragmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'video', 'bar_start', 'bar_end', 'duration_bars', 'created_at']
    list_filter = ['created_at', 'video']
    search_fields = ['name', 'description', 'video__title']
    readonly_fields = ['created_at', 'updated_at', 'duration_bars']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('video', 'name', 'description', 'color')
        }),
        ('Bar Range', {
            'fields': ('bar_start', 'bar_end', 'duration_bars')
        }),
        ('Classification', {
            'fields': ('tags',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
