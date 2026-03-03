"""
Classroom models for Ritmo Teaching Platform.

Hierarchy:
  UserProfile (role: teacher | student)
    └── Classroom (owned by teacher)
          ├── ClassroomMember (students enrolled)
          ├── Assignment (created by teacher)
          │     ├── ReferenceVideo (teacher's example)
          │     └── Submission (student's attempt)
          │           └── Feedback (teacher's review)
          │                 └── FeedbackAnnotation (bar-based comments)
          └── Announcement (teacher posts to class)

Key design decisions:
- Feedback annotations are tied to specific bars/beats, not seconds
- Submissions can be graded (approved/needs_work/rejected)
- Invite codes are 8-char random strings for easy sharing
- A user can be BOTH teacher and student (e.g. advanced student who teaches)
"""
import random
import string
from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimeStampedModel


def generate_invite_code():
    """Generate a random 8-character invite code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=8))


class UserProfile(TimeStampedModel):
    """
    Extends User with role information.
    A user can be teacher, student, or both.
    """
    ROLE_TEACHER = 'teacher'
    ROLE_STUDENT = 'student'
    ROLE_CHOICES = [
        (ROLE_TEACHER, 'Professor'),
        (ROLE_STUDENT, 'Aluno'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_STUDENT)

    bio = models.TextField(blank=True, help_text="Bio do professor")
    specialties = models.JSONField(
        default=list, blank=True,
        help_text="Lista de especialidades (ex: ['forró', 'samba', 'zouk'])",
    )
    avatar_url = models.URLField(blank=True)

    skill_level = models.CharField(
        max_length=20, blank=True,
        choices=[
            ('beginner', 'Iniciante'),
            ('intermediate', 'Intermediário'),
            ('advanced', 'Avançado'),
        ],
    )

    class Meta:
        indexes = [
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.get_role_display()})"

    @property
    def is_teacher(self):
        return self.role == self.ROLE_TEACHER

    @property
    def is_student(self):
        return self.role == self.ROLE_STUDENT


class Classroom(TimeStampedModel):
    """
    A class/turma created by a teacher.
    Students join via invite code.
    """
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='classrooms_owned',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    dance_style = models.CharField(
        max_length=50, blank=True,
        help_text="Estilo de dança (ex: forró, samba, zouk, salsa)",
    )

    invite_code = models.CharField(
        max_length=8, unique=True, default=generate_invite_code,
        db_index=True,
    )
    is_active = models.BooleanField(default=True)
    max_students = models.IntegerField(default=50)

    cover_color = models.CharField(
        max_length=7, default='#6366F1',
        help_text="Hex color for classroom card",
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['teacher', '-created_at']),
            models.Index(fields=['invite_code']),
        ]

    def __str__(self):
        return f"{self.name} ({self.teacher.get_full_name() or self.teacher.username})"

    @property
    def student_count(self):
        return self.members.filter(role='student').count()


class ClassroomMember(TimeStampedModel):
    """
    A student enrolled in a classroom.
    """
    ROLE_CHOICES = [
        ('student', 'Aluno'),
        ('assistant', 'Monitor'),
    ]

    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name='members',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='classroom_memberships',
    )
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default='student')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['classroom', 'user']
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.user.username} in {self.classroom.name}"


class Assignment(TimeStampedModel):
    """
    A task/exercise created by a teacher for a classroom.
    """
    STATUS_CHOICES = [
        ('draft', 'Rascunho'),
        ('published', 'Publicado'),
        ('closed', 'Encerrado'),
    ]

    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name='assignments',
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assignments_created',
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    instructions = models.TextField(
        blank=True,
        help_text="Instruções detalhadas para o aluno",
    )
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='draft')

    reference_video = models.ForeignKey(
        'videos.Video', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='assignments_as_reference',
        help_text="Vídeo de referência do professor",
    )

    focus_bar_start = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0)],
        help_text="Compasso inicial para focar",
    )
    focus_bar_end = models.IntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0)],
        help_text="Compasso final para focar",
    )

    target_bpm = models.FloatField(
        null=True, blank=True,
        help_text="BPM sugerido para o exercício",
    )

    published_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', '-created_at']
        indexes = [
            models.Index(fields=['classroom', 'status']),
        ]

    def __str__(self):
        return f"{self.title} ({self.classroom.name})"

    @property
    def submission_count(self):
        return self.submissions.count()

    @property
    def reviewed_count(self):
        return self.submissions.exclude(feedback__isnull=True).count()


class Submission(TimeStampedModel):
    """
    A student's video submission for an assignment.
    """
    STATUS_CHOICES = [
        ('submitted', 'Enviado'),
        ('in_review', 'Em Revisão'),
        ('approved', 'Aprovado'),
        ('needs_work', 'Precisa Melhorar'),
        ('rejected', 'Rejeitado'),
    ]

    assignment = models.ForeignKey(
        Assignment, on_delete=models.CASCADE, related_name='submissions',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
    )
    video = models.ForeignKey(
        'videos.Video',
        on_delete=models.CASCADE,
        related_name='submissions',
    )

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='submitted')
    student_notes = models.TextField(
        blank=True,
        help_text="Notas do aluno sobre a submissão",
    )
    attempt_number = models.IntegerField(default=1)

    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['assignment', 'student']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.student.username} → {self.assignment.title} (#{self.attempt_number})"


class Feedback(TimeStampedModel):
    """
    Teacher's overall feedback on a submission.
    Contains a general comment + grade + bar-specific annotations.
    """
    GRADE_CHOICES = [
        (1, 'Precisa Melhorar Muito'),
        (2, 'Precisa Melhorar'),
        (3, 'Bom'),
        (4, 'Muito Bom'),
        (5, 'Excelente'),
    ]

    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name='feedback',
    )
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedbacks_given',
    )

    overall_comment = models.TextField(
        help_text="Comentário geral sobre a performance",
    )
    grade = models.IntegerField(
        choices=GRADE_CHOICES,
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )

    strengths = models.JSONField(
        default=list, blank=True,
        help_text="Lista de pontos fortes",
    )
    improvements = models.JSONField(
        default=list, blank=True,
        help_text="Lista de pontos a melhorar",
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Feedback: {self.submission}"

    @property
    def annotation_count(self):
        return self.annotations.count()


class FeedbackAnnotation(TimeStampedModel):
    """
    A specific annotation on a video, tied to a bar/beat position.

    This is the core of the feedback system — teachers mark specific
    moments in the video and leave targeted comments.

    Annotation types:
    - correction: something the student did wrong
    - praise: something the student did well
    - tip: a suggestion for improvement
    - reference: "watch how I do it here" (links to teacher's video timestamp)
    """
    TYPE_CHOICES = [
        ('correction', 'Correção'),
        ('praise', 'Elogio'),
        ('tip', 'Dica'),
        ('reference', 'Referência'),
    ]

    feedback = models.ForeignKey(
        Feedback, on_delete=models.CASCADE, related_name='annotations',
    )

    bar_number = models.IntegerField(
        validators=[MinValueValidator(0)],
        help_text="Número do compasso (0-based)",
    )
    beat_number = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Número do tempo dentro do compasso (1-based)",
    )
    time_position = models.FloatField(
        null=True, blank=True,
        help_text="Posição em segundos (fallback se não houver BPM)",
    )

    annotation_type = models.CharField(max_length=12, choices=TYPE_CHOICES, default='correction')
    comment = models.TextField()

    reference_bar = models.IntegerField(
        null=True, blank=True,
        help_text="Compasso no vídeo de referência do professor",
    )
    reference_time = models.FloatField(
        null=True, blank=True,
        help_text="Tempo em segundos no vídeo de referência",
    )

    color = models.CharField(
        max_length=7, default='#EF4444',
        help_text="Cor do marcador (vermelho=correção, verde=elogio, azul=dica)",
    )

    class Meta:
        ordering = ['bar_number', 'beat_number']
        indexes = [
            models.Index(fields=['feedback', 'bar_number']),
        ]

    def __str__(self):
        return f"[{self.get_annotation_type_display()}] Bar {self.bar_number}.{self.beat_number}: {self.comment[:50]}"

    def save(self, *args, **kwargs):
        type_colors = {
            'correction': '#EF4444',
            'praise': '#22C55E',
            'tip': '#3B82F6',
            'reference': '#A855F7',
        }
        if not self.color or self.color == '#EF4444':
            self.color = type_colors.get(self.annotation_type, '#EF4444')
        super().save(*args, **kwargs)


class Announcement(TimeStampedModel):
    """
    Teacher posts/announcements in a classroom.
    """
    classroom = models.ForeignKey(
        Classroom, on_delete=models.CASCADE, related_name='announcements',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcements',
    )
    content = models.TextField()
    pinned = models.BooleanField(default=False)

    video = models.ForeignKey(
        'videos.Video', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='announcements',
    )

    class Meta:
        ordering = ['-pinned', '-created_at']

    def __str__(self):
        return f"[{self.classroom.name}] {self.content[:60]}"
