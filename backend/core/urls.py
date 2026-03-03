"""
Core URL configuration - Authentication endpoints.
"""
from django.urls import path, include
from . import views
from .social_views import GoogleLogin, FacebookLogin, GitHubLogin, AppleLogin

urlpatterns = [
    # dj-rest-auth endpoints (login, logout, password reset, etc.)
    path('auth/', include('dj_rest_auth.urls')),
    # dj-rest-auth registration (signup)
    path('auth/registration/', include('dj_rest_auth.registration.urls')),
    
    # Social auth token exchange endpoints (frontend sends access_token, gets JWT)
    path('auth/social/google/', GoogleLogin.as_view(), name='google-login'),
    path('auth/social/facebook/', FacebookLogin.as_view(), name='facebook-login'),
    path('auth/social/github/', GitHubLogin.as_view(), name='github-login'),
    path('auth/social/apple/', AppleLogin.as_view(), name='apple-login'),
    
    # Custom endpoints
    path('auth/status/', views.auth_status, name='auth-status'),
    path('auth/user/', views.current_user, name='current-user'),
    path('auth/claim-videos/', views.claim_anonymous_videos, name='claim-videos'),
]
