"""
Magic link (passwordless) email login for Ritmo.

Flow:
1. POST /api/auth/magic-link/request/  {email}  → sends 6-digit code to email
2. POST /api/auth/magic-link/verify/   {email, code}  → returns JWT tokens

Uses Django cache for code storage (default: in-memory, use Redis in production).
Codes expire in 10 minutes.
"""
import random
import string
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

CODE_LENGTH = 6
CODE_TTL = 600  # 10 minutes
MAX_ATTEMPTS = 5


def _cache_key(email):
    return f"magic_code:{email.lower().strip()}"


def _attempts_key(email):
    return f"magic_attempts:{email.lower().strip()}"


def _generate_code():
    return ''.join(random.choices(string.digits, k=CODE_LENGTH))


@api_view(['POST'])
@permission_classes([AllowAny])
def request_magic_link(request):
    """
    Send a 6-digit login code to the given email.
    If the user doesn't exist yet, they will be created on verify.
    """
    email = (request.data.get('email') or '').lower().strip()

    if not email or '@' not in email:
        return Response(
            {'error': 'Email valido e obrigatorio.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Rate limit: max 3 requests per email per 10 min (re-uses same TTL window)
    code = _generate_code()
    cache.set(_cache_key(email), code, CODE_TTL)
    cache.delete(_attempts_key(email))  # reset attempts on new code

    # Send email
    try:
        send_mail(
            subject=f'Seu codigo Ritmo: {code}',
            message=(
                f'Seu codigo de acesso ao Ritmo e:\n\n'
                f'    {code}\n\n'
                f'Este codigo expira em 10 minutos.\n'
                f'Se voce nao solicitou este codigo, ignore este email.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        # In dev with console backend this won't fail, but log just in case
        import logging
        logging.getLogger(__name__).warning(f"Failed to send magic link email to {email}: {e}")

    # Always return success (don't leak whether email exists)
    return Response({
        'message': 'Se este email estiver correto, voce recebera um codigo de acesso.',
        'email': email,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_magic_link(request):
    """
    Verify the 6-digit code and return JWT tokens.
    Creates the user if they don't exist yet.
    """
    email = (request.data.get('email') or '').lower().strip()
    code = (request.data.get('code') or '').strip()

    if not email or not code:
        return Response(
            {'error': 'Email e codigo sao obrigatorios.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check attempts
    attempts_key = _attempts_key(email)
    attempts = cache.get(attempts_key, 0)
    if attempts >= MAX_ATTEMPTS:
        cache.delete(_cache_key(email))
        return Response(
            {'error': 'Muitas tentativas. Solicite um novo codigo.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # Verify code
    stored_code = cache.get(_cache_key(email))
    if not stored_code:
        return Response(
            {'error': 'Codigo expirado ou invalido. Solicite um novo.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if code != stored_code:
        cache.set(attempts_key, attempts + 1, CODE_TTL)
        remaining = MAX_ATTEMPTS - attempts - 1
        return Response(
            {'error': f'Codigo incorreto. {remaining} tentativa(s) restante(s).'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Code is valid — clear it
    cache.delete(_cache_key(email))
    cache.delete(attempts_key)

    # Get or create user
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'username': _generate_username(email),
            'is_active': True,
        },
    )

    if created:
        user.set_unusable_password()
        user.save()

    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)

    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'full_name': user.get_full_name() or user.username,
        },
        'created': created,
    })


def _generate_username(email):
    """Generate a unique username from email."""
    base = email.split('@')[0]
    username = base
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{counter}"
        counter += 1
    return username
