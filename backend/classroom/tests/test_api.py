"""
Tests for classroom API endpoints.
"""
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from classroom.models import (
    UserProfile, Classroom, ClassroomMember, Assignment,
    Submission, Feedback, FeedbackAnnotation,
)
from videos.models import Video


class ProfileAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('profuser', 'prof@test.com', 'pass1234')

    def test_get_or_create_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/classroom/profiles/me/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['role'], 'student')

    def test_update_profile_role(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.put(
            '/api/classroom/profiles/me/',
            {'role': 'teacher'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'teacher')

    def test_unauthenticated(self):
        response = self.client.get('/api/classroom/profiles/me/')
        self.assertEqual(response.status_code, 401)


class ClassroomAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.student = User.objects.create_user('student', 'student@test.com', 'pass')
        UserProfile.objects.create(user=self.teacher, role='teacher')
        UserProfile.objects.create(user=self.student, role='student')

    def test_create_classroom(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post('/api/classroom/classrooms/', {
            'name': 'Forró Iniciante',
            'dance_style': 'forró',
            'description': 'Turma para iniciantes',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['name'], 'Forró Iniciante')
        self.assertEqual(len(data['invite_code']), 8)

    def test_join_classroom(self):
        self.client.force_authenticate(user=self.teacher)
        res = self.client.post('/api/classroom/classrooms/', {'name': 'Join Test'}, format='json')
        code = res.json()['invite_code']

        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/classroom/classrooms/join/', {
            'invite_code': code,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(ClassroomMember.objects.filter(
            classroom__invite_code=code, user=self.student,
        ).exists())

    def test_join_invalid_code(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/classroom/classrooms/join/', {
            'invite_code': 'INVALID0',
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_join_already_member(self):
        c = Classroom.objects.create(teacher=self.teacher, name='Test')
        ClassroomMember.objects.create(classroom=c, user=self.student)

        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/classroom/classrooms/join/', {
            'invite_code': c.invite_code,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_teacher_cannot_join_own_class(self):
        c = Classroom.objects.create(teacher=self.teacher, name='Test')
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post('/api/classroom/classrooms/join/', {
            'invite_code': c.invite_code,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_leave_classroom(self):
        c = Classroom.objects.create(teacher=self.teacher, name='Test')
        ClassroomMember.objects.create(classroom=c, user=self.student)

        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/classroom/classrooms/{c.id}/leave/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(ClassroomMember.objects.filter(classroom=c, user=self.student).exists())

    def test_regenerate_code(self):
        c = Classroom.objects.create(teacher=self.teacher, name='Test')
        old_code = c.invite_code

        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(f'/api/classroom/classrooms/{c.id}/regenerate-code/')
        self.assertEqual(response.status_code, 200)
        new_code = response.json()['invite_code']
        self.assertNotEqual(old_code, new_code)

    def test_regenerate_code_forbidden_for_student(self):
        c = Classroom.objects.create(teacher=self.teacher, name='Test')
        ClassroomMember.objects.create(classroom=c, user=self.student)

        self.client.force_authenticate(user=self.student)
        response = self.client.post(f'/api/classroom/classrooms/{c.id}/regenerate-code/')
        self.assertEqual(response.status_code, 403)

    def test_list_own_classrooms(self):
        Classroom.objects.create(teacher=self.teacher, name='Mine')
        other = User.objects.create_user('other', 'other@test.com', 'pass')
        Classroom.objects.create(teacher=other, name='Not mine')

        self.client.force_authenticate(user=self.teacher)
        response = self.client.get('/api/classroom/classrooms/')
        data = response.json()
        results = data.get('results', data)
        names = [c['name'] for c in results]
        self.assertIn('Mine', names)
        self.assertNotIn('Not mine', names)


class AssignmentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.student = User.objects.create_user('student', 'student@test.com', 'pass')
        self.classroom = Classroom.objects.create(teacher=self.teacher, name='Test')
        ClassroomMember.objects.create(classroom=self.classroom, user=self.student)

    def test_create_assignment(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post('/api/classroom/assignments/', {
            'classroom': self.classroom.id,
            'title': 'Giro',
            'status': 'published',
            'focus_bar_start': 4,
            'focus_bar_end': 8,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['title'], 'Giro')

    def test_student_sees_only_published(self):
        Assignment.objects.create(
            classroom=self.classroom, teacher=self.teacher,
            title='Draft', status='draft',
        )
        Assignment.objects.create(
            classroom=self.classroom, teacher=self.teacher,
            title='Published', status='published',
        )
        self.client.force_authenticate(user=self.student)
        response = self.client.get(f'/api/classroom/assignments/?classroom={self.classroom.id}')
        data = response.json()
        results = data.get('results', data)
        titles = [a['title'] for a in results]
        self.assertIn('Published', titles)
        self.assertNotIn('Draft', titles)

    def test_publish_assignment(self):
        a = Assignment.objects.create(
            classroom=self.classroom, teacher=self.teacher,
            title='Draft', status='draft',
        )
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(f'/api/classroom/assignments/{a.id}/publish/')
        self.assertEqual(response.status_code, 200)
        a.refresh_from_db()
        self.assertEqual(a.status, 'published')
        self.assertIsNotNone(a.published_at)


class SubmissionAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
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

    def test_submit_video(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post('/api/classroom/submissions/', {
            'assignment': self.assignment.id,
            'video': self.video.id,
            'student_notes': 'Minha tentativa',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        sub = Submission.objects.get(student=self.student)
        self.assertEqual(sub.attempt_number, 1)

    def test_second_submission_increments_attempt(self):
        self.client.force_authenticate(user=self.student)
        self.client.post('/api/classroom/submissions/', {
            'assignment': self.assignment.id, 'video': self.video.id,
        }, format='json')
        self.client.post('/api/classroom/submissions/', {
            'assignment': self.assignment.id, 'video': self.video.id,
        }, format='json')
        subs = Submission.objects.filter(student=self.student).order_by('attempt_number')
        self.assertEqual(subs[0].attempt_number, 1)
        self.assertEqual(subs[1].attempt_number, 2)

    def test_non_member_cannot_submit(self):
        outsider = User.objects.create_user('outsider', 'out@test.com', 'pass')
        v = Video.objects.create(title='V', owner=outsider, file='v.mp4', duration=30.0)
        self.client.force_authenticate(user=outsider)
        response = self.client.post('/api/classroom/submissions/', {
            'assignment': self.assignment.id, 'video': v.id,
        }, format='json')
        self.assertEqual(response.status_code, 400)


class FeedbackAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.teacher = User.objects.create_user('teacher', 'teacher@test.com', 'pass')
        self.student = User.objects.create_user('student', 'student@test.com', 'pass')
        self.classroom = Classroom.objects.create(teacher=self.teacher, name='Test')
        ClassroomMember.objects.create(classroom=self.classroom, user=self.student)
        self.assignment = Assignment.objects.create(
            classroom=self.classroom, teacher=self.teacher,
            title='Test', status='published',
        )
        self.video = Video.objects.create(
            title='V', owner=self.student, file='v.mp4', duration=60.0,
        )
        self.submission = Submission.objects.create(
            assignment=self.assignment, student=self.student, video=self.video,
        )

    def test_add_feedback(self):
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(
            f'/api/classroom/submissions/{self.submission.id}/feedback/',
            {
                'overall_comment': 'Bom trabalho!',
                'grade': 4,
                'strengths': ['Ritmo certo'],
                'improvements': ['Postura'],
                'annotations': [
                    {'bar_number': 8, 'beat_number': 3, 'annotation_type': 'correction', 'comment': 'Atrasou'},
                    {'bar_number': 12, 'beat_number': 1, 'annotation_type': 'praise', 'comment': 'Ótimo!'},
                ],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['grade'], 4)
        self.assertEqual(len(data['annotations']), 2)

        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, 'approved')

    def test_feedback_grade_sets_needs_work(self):
        self.client.force_authenticate(user=self.teacher)
        self.client.post(
            f'/api/classroom/submissions/{self.submission.id}/feedback/',
            {'overall_comment': 'Precisa melhorar', 'grade': 2},
            format='json',
        )
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, 'needs_work')

    def test_duplicate_feedback_rejected(self):
        Feedback.objects.create(
            submission=self.submission, teacher=self.teacher,
            overall_comment='Exists',
        )
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(
            f'/api/classroom/submissions/{self.submission.id}/feedback/',
            {'overall_comment': 'Duplicate'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_student_cannot_give_feedback(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            f'/api/classroom/submissions/{self.submission.id}/feedback/',
            {'overall_comment': 'I am student'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_add_single_annotation(self):
        Feedback.objects.create(
            submission=self.submission, teacher=self.teacher,
            overall_comment='Ok',
        )
        self.client.force_authenticate(user=self.teacher)
        response = self.client.post(
            f'/api/classroom/submissions/{self.submission.id}/annotations/',
            {'bar_number': 5, 'beat_number': 1, 'annotation_type': 'tip', 'comment': 'Try this'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(FeedbackAnnotation.objects.count(), 1)
