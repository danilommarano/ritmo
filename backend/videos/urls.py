"""
URL configuration for videos app
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VideoViewSet, RhythmGridViewSet, FragmentViewSet

router = DefaultRouter()
router.register(r'videos', VideoViewSet, basename='video')
router.register(r'rhythm-grids', RhythmGridViewSet, basename='rhythmgrid')
router.register(r'fragments', FragmentViewSet, basename='fragment')

urlpatterns = [
    path('', include(router.urls)),
]
