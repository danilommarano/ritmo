"""
Custom allauth adapters for Ritmo.
"""
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class CustomAccountAdapter(DefaultAccountAdapter):
    """Custom account adapter - auto-generate username from email."""
    
    def populate_username(self, request, user):
        """Generate username from email if not provided."""
        if not user.username:
            email = user.email or ''
            base_username = email.split('@')[0] if email else 'user'
            from django.contrib.auth.models import User
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            user.username = username


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Custom social account adapter - auto-connect social accounts."""
    
    def pre_social_login(self, request, sociallogin):
        """
        If a user already exists with this email, connect the social account
        to the existing user instead of creating a new one.
        """
        if sociallogin.is_existing:
            return
        
        email = None
        if sociallogin.account.extra_data:
            email = sociallogin.account.extra_data.get('email')
        
        if not email and sociallogin.email_addresses:
            email = sociallogin.email_addresses[0].email
        
        if email:
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(email=email)
                sociallogin.connect(request, user)
            except User.DoesNotExist:
                pass
