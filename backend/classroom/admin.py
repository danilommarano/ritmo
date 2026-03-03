from django.contrib import admin
from .models import (
    UserProfile, Classroom, ClassroomMember, Assignment,
    Submission, Feedback, FeedbackAnnotation, Announcement,
)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'skill_level', 'created_at']
    list_filter = ['role', 'skill_level']
    search_fields = ['user__username', 'user__email']


class ClassroomMemberInline(admin.TabularInline):
    model = ClassroomMember
    extra = 0


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ['name', 'teacher', 'dance_style', 'invite_code', 'is_active', 'student_count', 'created_at']
    list_filter = ['is_active', 'dance_style']
    search_fields = ['name', 'teacher__username']
    inlines = [ClassroomMemberInline]

    def student_count(self, obj):
        return obj.members.filter(role='student').count()


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'classroom', 'teacher', 'status', 'due_date', 'created_at']
    list_filter = ['status', 'classroom']
    search_fields = ['title', 'classroom__name']


class FeedbackAnnotationInline(admin.TabularInline):
    model = FeedbackAnnotation
    extra = 0


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ['student', 'assignment', 'status', 'attempt_number', 'submitted_at']
    list_filter = ['status']
    search_fields = ['student__username', 'assignment__title']


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ['submission', 'teacher', 'grade', 'annotation_count', 'created_at']
    list_filter = ['grade']
    inlines = [FeedbackAnnotationInline]

    def annotation_count(self, obj):
        return obj.annotations.count()


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ['classroom', 'author', 'pinned', 'created_at']
    list_filter = ['pinned', 'classroom']
