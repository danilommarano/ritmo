"""
Serializers for the Classroom teaching platform.
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    UserProfile, Classroom, ClassroomMember, Assignment,
    Submission, Feedback, FeedbackAnnotation, Announcement,
)


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'role', 'bio', 'specialties',
            'avatar_url', 'skill_level', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ClassroomMemberSerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)

    class Meta:
        model = ClassroomMember
        fields = ['id', 'user', 'role', 'joined_at']


class ClassroomListSerializer(serializers.ModelSerializer):
    teacher = UserMiniSerializer(read_only=True)
    student_count = serializers.IntegerField(read_only=True)
    assignment_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Classroom
        fields = [
            'id', 'name', 'description', 'dance_style', 'teacher',
            'invite_code', 'is_active', 'student_count',
            'assignment_count', 'cover_color', 'my_role', 'created_at',
        ]
        read_only_fields = ['id', 'invite_code', 'teacher', 'created_at']

    def get_assignment_count(self, obj):
        return obj.assignments.filter(status='published').count()

    def get_my_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        if obj.teacher == request.user:
            return 'teacher'
        membership = obj.members.filter(user=request.user).first()
        return membership.role if membership else None


class ClassroomDetailSerializer(ClassroomListSerializer):
    members = ClassroomMemberSerializer(many=True, read_only=True)

    class Meta(ClassroomListSerializer.Meta):
        fields = ClassroomListSerializer.Meta.fields + ['members', 'max_students']


class ClassroomCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = ['name', 'description', 'dance_style', 'cover_color', 'max_students']


class AssignmentListSerializer(serializers.ModelSerializer):
    teacher = UserMiniSerializer(read_only=True)
    submission_count = serializers.IntegerField(read_only=True)
    reviewed_count = serializers.IntegerField(read_only=True)
    my_submission = serializers.SerializerMethodField()
    reference_video_title = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'instructions', 'status',
            'teacher', 'reference_video', 'reference_video_title',
            'focus_bar_start', 'focus_bar_end', 'target_bpm',
            'published_at', 'due_date', 'order',
            'submission_count', 'reviewed_count', 'my_submission',
            'created_at',
        ]

    def get_my_submission(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        sub = obj.submissions.filter(student=request.user).order_by('-attempt_number').first()
        if sub:
            return {
                'id': sub.id,
                'status': sub.status,
                'attempt_number': sub.attempt_number,
                'has_feedback': hasattr(sub, 'feedback'),
            }
        return None

    def get_reference_video_title(self, obj):
        if obj.reference_video:
            return obj.reference_video.title
        return None


class AssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assignment
        fields = [
            'title', 'description', 'instructions', 'status',
            'reference_video', 'focus_bar_start', 'focus_bar_end',
            'target_bpm', 'due_date', 'order',
        ]


class FeedbackAnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackAnnotation
        fields = [
            'id', 'bar_number', 'beat_number', 'time_position',
            'annotation_type', 'comment', 'reference_bar',
            'reference_time', 'color', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class FeedbackSerializer(serializers.ModelSerializer):
    teacher = UserMiniSerializer(read_only=True)
    annotations = FeedbackAnnotationSerializer(many=True, read_only=True)
    annotation_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Feedback
        fields = [
            'id', 'teacher', 'overall_comment', 'grade',
            'strengths', 'improvements', 'annotations',
            'annotation_count', 'created_at',
        ]
        read_only_fields = ['id', 'teacher', 'created_at']


class FeedbackCreateSerializer(serializers.ModelSerializer):
    annotations = FeedbackAnnotationSerializer(many=True, required=False)

    class Meta:
        model = Feedback
        fields = [
            'overall_comment', 'grade', 'strengths', 'improvements',
            'annotations',
        ]

    def create(self, validated_data):
        annotations_data = validated_data.pop('annotations', [])
        feedback = Feedback.objects.create(**validated_data)
        for ann_data in annotations_data:
            FeedbackAnnotation.objects.create(feedback=feedback, **ann_data)
        return feedback


class SubmissionListSerializer(serializers.ModelSerializer):
    student = UserMiniSerializer(read_only=True)
    has_feedback = serializers.SerializerMethodField()
    video_title = serializers.SerializerMethodField()
    video_duration = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            'id', 'student', 'video', 'video_title', 'video_duration',
            'status', 'student_notes',
            'attempt_number', 'has_feedback', 'submitted_at',
        ]

    def get_has_feedback(self, obj):
        return hasattr(obj, 'feedback')

    def get_video_title(self, obj):
        return obj.video.title if obj.video else None

    def get_video_duration(self, obj):
        return obj.video.duration if obj.video else None


class SubmissionDetailSerializer(SubmissionListSerializer):
    feedback = FeedbackSerializer(read_only=True)

    class Meta(SubmissionListSerializer.Meta):
        fields = SubmissionListSerializer.Meta.fields + ['feedback', 'reviewed_at']


class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['video', 'student_notes']


class AnnouncementSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)

    class Meta:
        model = Announcement
        fields = ['id', 'author', 'content', 'pinned', 'video', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']
