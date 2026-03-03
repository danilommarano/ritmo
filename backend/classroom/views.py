"""
Views for the Classroom teaching platform.
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q
from .models import (
    UserProfile, Classroom, ClassroomMember, Assignment,
    Submission, Feedback, FeedbackAnnotation, Announcement,
)
from .serializers import (
    UserProfileSerializer, ClassroomListSerializer, ClassroomDetailSerializer,
    ClassroomCreateSerializer, ClassroomMemberSerializer,
    AssignmentListSerializer, AssignmentCreateSerializer,
    SubmissionListSerializer, SubmissionDetailSerializer, SubmissionCreateSerializer,
    FeedbackSerializer, FeedbackCreateSerializer, FeedbackAnnotationSerializer,
    AnnouncementSerializer,
)


class IsTeacherOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        profile = getattr(request.user, 'profile', None)
        return profile and profile.is_teacher


class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        profile, created = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={'role': 'student'},
        )
        if request.method == 'GET':
            return Response(UserProfileSerializer(profile, context={'request': request}).data)

        serializer = UserProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ClassroomViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return ClassroomCreateSerializer
        if self.action == 'retrieve':
            return ClassroomDetailSerializer
        return ClassroomListSerializer

    def get_queryset(self):
        user = self.request.user
        return Classroom.objects.filter(
            Q(teacher=user) | Q(members__user=user)
        ).distinct().annotate(
            student_count=Count('members', filter=Q(members__role='student')),
        )

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user)

    @action(detail=False, methods=['post'], url_path='join')
    def join(self, request):
        """Join a classroom via invite code."""
        code = request.data.get('invite_code', '').strip().upper()
        if not code:
            return Response({'detail': 'Código de convite é obrigatório.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            classroom = Classroom.objects.get(invite_code=code, is_active=True)
        except Classroom.DoesNotExist:
            return Response({'detail': 'Código de convite inválido.'}, status=status.HTTP_404_NOT_FOUND)

        if classroom.teacher == request.user:
            return Response({'detail': 'Você é o professor desta turma.'}, status=status.HTTP_400_BAD_REQUEST)

        if classroom.members.filter(user=request.user).exists():
            return Response({'detail': 'Você já está nesta turma.'}, status=status.HTTP_400_BAD_REQUEST)

        if classroom.student_count >= classroom.max_students:
            return Response({'detail': 'Turma lotada.'}, status=status.HTTP_400_BAD_REQUEST)

        ClassroomMember.objects.create(classroom=classroom, user=request.user, role='student')

        # Ensure user has a profile
        UserProfile.objects.get_or_create(user=request.user, defaults={'role': 'student'})

        return Response(
            ClassroomListSerializer(classroom, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='leave')
    def leave(self, request, pk=None):
        """Leave a classroom."""
        classroom = self.get_object()
        membership = ClassroomMember.objects.filter(classroom=classroom, user=request.user)
        if not membership.exists():
            return Response({'detail': 'Você não é membro desta turma.'}, status=status.HTTP_400_BAD_REQUEST)
        membership.delete()
        return Response({'detail': 'Saiu da turma.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='regenerate-code')
    def regenerate_code(self, request, pk=None):
        """Regenerate invite code (teacher only)."""
        classroom = self.get_object()
        if classroom.teacher != request.user:
            return Response({'detail': 'Apenas o professor pode alterar o código.'}, status=status.HTTP_403_FORBIDDEN)
        from .models import generate_invite_code
        classroom.invite_code = generate_invite_code()
        classroom.save(update_fields=['invite_code'])
        return Response({'invite_code': classroom.invite_code})

    @action(detail=True, methods=['get'])
    def announcements(self, request, pk=None):
        classroom = self.get_object()
        announcements = Announcement.objects.filter(classroom=classroom)
        return Response(AnnouncementSerializer(announcements, many=True).data)

    @action(detail=True, methods=['post'], url_path='announce')
    def create_announcement(self, request, pk=None):
        classroom = self.get_object()
        if classroom.teacher != request.user:
            return Response({'detail': 'Apenas o professor pode criar avisos.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = AnnouncementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(classroom=classroom, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AssignmentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AssignmentCreateSerializer
        return AssignmentListSerializer

    def get_queryset(self):
        user = self.request.user
        classroom_id = self.request.query_params.get('classroom')

        qs = Assignment.objects.select_related('teacher', 'reference_video').annotate(
            submission_count=Count('submissions'),
            reviewed_count=Count('submissions', filter=Q(submissions__feedback__isnull=False)),
        )

        if classroom_id:
            qs = qs.filter(classroom_id=classroom_id)

        # Teachers see all; students see only published
        teacher_classrooms = Classroom.objects.filter(teacher=user).values_list('id', flat=True)
        student_classrooms = ClassroomMember.objects.filter(user=user).values_list('classroom_id', flat=True)

        qs = qs.filter(
            Q(classroom_id__in=teacher_classrooms) |
            Q(classroom_id__in=student_classrooms, status='published')
        )
        return qs.distinct()

    def perform_create(self, serializer):
        classroom_id = self.request.data.get('classroom')
        try:
            classroom = Classroom.objects.get(id=classroom_id, teacher=self.request.user)
        except Classroom.DoesNotExist:
            raise serializers.ValidationError({'classroom': 'Turma não encontrada ou você não é o professor.'})

        status_val = serializer.validated_data.get('status', 'draft')
        published_at = timezone.now() if status_val == 'published' else None
        serializer.save(teacher=self.request.user, classroom=classroom, published_at=published_at)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        assignment = self.get_object()
        if assignment.teacher != request.user:
            return Response({'detail': 'Apenas o professor pode publicar.'}, status=status.HTTP_403_FORBIDDEN)
        assignment.status = 'published'
        assignment.published_at = timezone.now()
        assignment.save(update_fields=['status', 'published_at'])
        return Response(AssignmentListSerializer(assignment, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def submissions(self, request, pk=None):
        """List all submissions for this assignment (teacher) or own submissions (student)."""
        assignment = self.get_object()
        qs = assignment.submissions.select_related('student', 'video')

        if assignment.teacher != request.user:
            qs = qs.filter(student=request.user)

        return Response(SubmissionListSerializer(qs, many=True).data)


class SubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return SubmissionCreateSerializer
        if self.action == 'retrieve':
            return SubmissionDetailSerializer
        return SubmissionListSerializer

    def get_queryset(self):
        user = self.request.user
        # Students see own submissions; teachers see submissions in their classrooms
        teacher_classrooms = Classroom.objects.filter(teacher=user).values_list('id', flat=True)
        return Submission.objects.select_related(
            'student', 'video', 'assignment', 'assignment__classroom',
        ).filter(
            Q(student=user) |
            Q(assignment__classroom_id__in=teacher_classrooms)
        ).distinct()

    def perform_create(self, serializer):
        assignment_id = self.request.data.get('assignment')
        try:
            assignment = Assignment.objects.get(id=assignment_id, status='published')
        except Assignment.DoesNotExist:
            raise serializers.ValidationError({'assignment': 'Atividade não encontrada ou não publicada.'})

        # Check membership
        is_member = ClassroomMember.objects.filter(
            classroom=assignment.classroom, user=self.request.user,
        ).exists()
        if not is_member:
            raise serializers.ValidationError({'detail': 'Você não é membro desta turma.'})

        # Calculate attempt number
        prev_count = Submission.objects.filter(
            assignment=assignment, student=self.request.user,
        ).count()

        serializer.save(
            student=self.request.user,
            assignment=assignment,
            attempt_number=prev_count + 1,
        )

    @action(detail=True, methods=['post'], url_path='feedback')
    def add_feedback(self, request, pk=None):
        """Teacher adds feedback to a submission."""
        submission = self.get_object()

        if submission.assignment.classroom.teacher != request.user:
            return Response({'detail': 'Apenas o professor pode dar feedback.'}, status=status.HTTP_403_FORBIDDEN)

        if hasattr(submission, 'feedback'):
            return Response({'detail': 'Feedback já existe. Use PUT para atualizar.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = FeedbackCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback = serializer.save(submission=submission, teacher=request.user)

        # Update submission status
        grade = feedback.grade
        if grade and grade >= 3:
            submission.status = 'approved'
        elif grade:
            submission.status = 'needs_work'
        else:
            submission.status = 'in_review'
        submission.reviewed_at = timezone.now()
        submission.save(update_fields=['status', 'reviewed_at'])

        return Response(
            FeedbackSerializer(feedback, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['put', 'patch'], url_path='feedback/update')
    def update_feedback(self, request, pk=None):
        """Teacher updates existing feedback."""
        submission = self.get_object()
        if submission.assignment.classroom.teacher != request.user:
            return Response({'detail': 'Apenas o professor pode editar feedback.'}, status=status.HTTP_403_FORBIDDEN)

        if not hasattr(submission, 'feedback'):
            return Response({'detail': 'Nenhum feedback para atualizar.'}, status=status.HTTP_404_NOT_FOUND)

        feedback = submission.feedback
        serializer = FeedbackCreateSerializer(feedback, data=request.data, partial=(request.method == 'PATCH'))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FeedbackSerializer(feedback, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='annotations')
    def add_annotation(self, request, pk=None):
        """Add a single annotation to existing feedback."""
        submission = self.get_object()
        if submission.assignment.classroom.teacher != request.user:
            return Response({'detail': 'Apenas o professor pode anotar.'}, status=status.HTTP_403_FORBIDDEN)

        if not hasattr(submission, 'feedback'):
            return Response({'detail': 'Crie o feedback primeiro.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = FeedbackAnnotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(feedback=submission.feedback)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
