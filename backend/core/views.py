"""
Core views - Authentication and session management.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from videos.models import Video


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_anonymous_videos(request):
    """
    After login/signup, claim videos from an anonymous session.
    Expects JSON body: { "session_key": "..." }
    """
    session_key = request.data.get('session_key', '')
    if not session_key:
        return Response(
            {'detail': 'session_key is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Find all anonymous videos with this session key
    anonymous_videos = Video.objects.filter(
        session_key=session_key,
        owner__isnull=True
    )
    
    count = anonymous_videos.count()
    if count == 0:
        return Response({'claimed': 0, 'detail': 'No anonymous videos found'})
    
    # Transfer ownership
    anonymous_videos.update(owner=request.user, session_key=None)
    
    return Response({
        'claimed': count,
        'detail': f'{count} video(s) claimed successfully'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    Get current authenticated user info.
    """
    user = request.user
    
    # Get social accounts info
    social_accounts = []
    try:
        from allauth.socialaccount.models import SocialAccount
        for sa in SocialAccount.objects.filter(user=user):
            social_accounts.append({
                'provider': sa.provider,
                'uid': sa.uid,
                'extra_data': {
                    'name': sa.extra_data.get('name', ''),
                    'picture': sa.extra_data.get('picture', sa.extra_data.get('avatar_url', '')),
                }
            })
    except Exception:
        pass
    
    return Response({
        'id': user.id,
        'email': user.email,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'full_name': user.get_full_name() or user.username,
        'social_accounts': social_accounts,
        'video_count': Video.objects.filter(owner=user).count(),
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def auth_status(request):
    """
    Check if the current request is authenticated.
    Used by frontend to determine auth state.
    """
    if request.user.is_authenticated:
        return Response({
            'authenticated': True,
            'user': {
                'id': request.user.id,
                'email': request.user.email,
                'username': request.user.username,
                'full_name': request.user.get_full_name() or request.user.username,
            }
        })
    return Response({'authenticated': False})
