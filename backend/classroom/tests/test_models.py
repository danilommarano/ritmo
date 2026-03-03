"""
Tests for classroom models.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from classroom.models import (
    UserProfile, Classroom, ClassroomMember, Assignment,
    Submission, Feedback, FeedbackAnnotation, Announcement,
    generate_invite_code,
)
from videos.models import Video


class GenerateInviteCodeTests(TestCase):
    def test_length(self):
        code = generate_invite_code()
        self.assertEqual(len(code), 8)

    def test_unique_codes(self):
        codes = {generate_invite_code() for _ in range(100)}
        self.assertGreater(len(codes), 90)


class UserProfileTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('profuser', 'prof@test.com', 'pass1234')

    def test_create_teacher(self):
        p = UserProfile.objects.create(user=self.user, role='teacher', bio='Dança forró')
        self.assertTrue(p.is_teacher)
        self.assertFalse(p.is_student)
        self.assertIn('Professor', str(p))

    def test_create_student(self):
        p = UserProfile.objects.create(user=self.user, role='student', skill_level='beginner')
        self.assertTrue(p.is_student)
        self.assertFalse(p.is_teacher)


class ClassroomTests(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user('teacher1', 'teacher@test.com', 'pass1234')

    def test_create_classroom(self):
        c = Classroom.objects.create(
            teacher=self.teacher, name='Forró Iniciante',
            dance_style='forró', description='Turma para iniciantes',
        )
        self.assertEqual(len(c.invite_code), 8)
        self.assertTrue(c.is_active)
        self.assertEqual(c.student_count, 0)
        self.assertIn('Forró Iniciante', str(c))

    def test_student_count(self):
        c = Classroom.objects.create(teacher=self.teacher, name='Test')
        s1 = User.objects.create_user('s1', 's1@test.com', 'pass')
        s2 = User.objects.create_user('s2', 's2@test.com', 'pass')
        ClassroomMember.objects.create(classroom=c, user=s1, role='student')
        ClassroomMember.objects.create(classroom=c, user=s2, role='student')
        self.assertEqual(c.student_count, 2)

    def test_unique_invite_code(self):
        c1 = Classroom.objects.create(teacher=self.teacher, name='A')
        c2 = Classroom.objects.create(teacher=self.teacher, name='B')
        self.assertNotEqual(c1.invite_code, c2.invite_code)


class ClassroomMemberTests(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.student = User.objects.create_user('student', 'student@test.com', 'pass')
        self.classroom = Classroom.objects.create(teacher=self.teacher, name='Test')

    def test_add_member(self):
        m = ClassroomMember.objects.create(classroom=self.classroom, user=self.student)
        self.assertEqual(m.role, 'student')
        self.assertIn('student', str(m))

    def test_unique_together(self):
        ClassroomMember.objects.create(classroom=self.classroom, user=self.student)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            ClassroomMember.objects.create(classroom=self.classroom, user=self.student)


class AssignmentTests(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.classroom = Classroom.objects.create(teacher=self.teacher, name='Test')

    def test_create_assignment(self):
        a = Assignment.objects.create(
            classroom=self.classroom, teacher=self.teacher,
            title='Praticar giro', status='published',
            focus_bar_start=4, focus_bar_end=8, target_bpm=120.0,
        )
        self.assertEqual(a.submission_count, 0)
        self.assertEqual(a.reviewed_count, 0)
        self.assertIn('Praticar giro', str(a))


class SubmissionAndFeedbackTests(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.student = User.objects.create_user('student', 'student@test.com', 'pass')
        self.classroom = Classroom.objects.create(teacher=self.teacher, name='Test')
        ClassroomMember.objects.create(classroom=self.classroom, user=self.student)
        self.assignment = Assignment.objects.create(
            classroom=self.classroom, teacher=self.teacher,
            title='Test', status='published',
        )
        self.video = Video.objects.create(
            title='Student Video', owner=self.student,
            file='videos/test.mp4', duration=60.0,
        )

    def test_create_submission(self):
        s = Submission.objects.create(
            assignment=self.assignment, student=self.student,
            video=self.video, student_notes='Minha tentativa',
        )
        self.assertEqual(s.status, 'submitted')
        self.assertEqual(s.attempt_number, 1)
        self.assertIn('student', str(s))

    def test_create_feedback_with_annotations(self):
        sub = Submission.objects.create(
            assignment=self.assignment, student=self.student, video=self.video,
        )
        fb = Feedback.objects.create(
            submission=sub, teacher=self.teacher,
            overall_comment='Bom trabalho!', grade=4,
            strengths=['Ritmo certo', 'Boa postura'],
            improvements=['Braços mais soltos'],
        )
        self.assertEqual(fb.annotation_count, 0)

        ann = FeedbackAnnotation.objects.create(
            feedback=fb, bar_number=8, beat_number=3,
            annotation_type='correction',
            comment='Atrasou aqui no giro',
        )
        self.assertEqual(ann.color, '#EF4444')
        self.assertEqual(fb.annotation_count, 1)

    def test_annotation_auto_color(self):
        sub = Submission.objects.create(
            assignment=self.assignment, student=self.student, video=self.video,
        )
        fb = Feedback.objects.create(
            submission=sub, teacher=self.teacher, overall_comment='Ok',
        )
        praise = FeedbackAnnotation.objects.create(
            feedback=fb, bar_number=0, annotation_type='praise', comment='Nice!',
        )
        self.assertEqual(praise.color, '#22C55E')

        tip = FeedbackAnnotation.objects.create(
            feedback=fb, bar_number=1, annotation_type='tip', comment='Try this',
        )
        self.assertEqual(tip.color, '#3B82F6')


class AnnouncementTests(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.classroom = Classroom.objects.create(teacher=self.teacher, name='Test')

    def test_create_announcement(self):
        a = Announcement.objects.create(
            classroom=self.classroom, author=self.teacher,
            content='Aula cancelada amanhã', pinned=True,
        )
        self.assertTrue(a.pinned)
        self.assertIn('Aula cancelada', str(a))
