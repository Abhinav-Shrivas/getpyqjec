"""
Custom DRF permission classes for GetPYQJEC.

IsVerifiedStudent — Enforces student verification on PYQ upload endpoints.
IsAdminUser       — Restricts admin-api endpoints to staff / admin-role users.
"""

from rest_framework.permissions import BasePermission


class IsVerifiedStudent(BasePermission):
    """
    Allows access only to authenticated users whose verification status is 'verified'.

    This is enforced server-side on every request — frontend button state is NOT
    sufficient access control.

    Returns a descriptive error message so the frontend can show appropriate guidance.
    """

    message = 'Student verification required to perform this action.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Admins bypass verification requirement
        if user.role == 'admin' or user.is_staff:
            return True

        try:
            verification = user.verification
        except Exception:
            self.message = (
                'You must verify your student ID before uploading PYQs. '
                'Go to the verification page to submit your college ID card.'
            )
            return False

        if verification.status == 'verified':
            return True

        status_messages = {
            'unverified': (
                'You must verify your student ID before uploading PYQs. '
                'Go to the verification page to submit your college ID card.'
            ),
            'pending': (
                'Your verification is currently under review by an administrator. '
                'Please wait for approval before uploading PYQs.'
            ),
            'rejected': (
                'Your verification was rejected. '
                'Please check the rejection reason and resubmit your ID card.'
            ),
        }
        self.message = status_messages.get(verification.status, self.message)
        return False


class IsAdminUser(BasePermission):
    """
    Allows access only to authenticated users with admin role, is_staff flag, or is_superuser.

    Used on admin-api verification management and upload history endpoints.
    """

    message = 'Administrator access required.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(user.role == 'admin' or user.is_staff or getattr(user, 'is_superuser', False))

