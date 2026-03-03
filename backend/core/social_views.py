"""
Social authentication views for SPA frontend.
The frontend handles the OAuth redirect flow and sends the access_token here.
This view exchanges it for a JWT token pair.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.facebook.views import FacebookOAuth2Adapter
from allauth.socialaccount.providers.github.views import GitHubOAuth2Adapter
from allauth.socialaccount.providers.apple.views import AppleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView


class GoogleLogin(SocialLoginView):
    """Exchange Google OAuth2 access_token for JWT."""
    adapter_class = GoogleOAuth2Adapter
    callback_url = 'postmessage'  # For Google Sign-In popup flow
    client_class = OAuth2Client


class FacebookLogin(SocialLoginView):
    """Exchange Facebook OAuth2 access_token for JWT."""
    adapter_class = FacebookOAuth2Adapter


class GitHubLogin(SocialLoginView):
    """Exchange GitHub OAuth2 access_token/code for JWT."""
    adapter_class = GitHubOAuth2Adapter
    callback_url = 'http://localhost:5173/auth/callback/github'
    client_class = OAuth2Client


class AppleLogin(SocialLoginView):
    """Exchange Apple OAuth2 code/id_token for JWT."""
    adapter_class = AppleOAuth2Adapter
