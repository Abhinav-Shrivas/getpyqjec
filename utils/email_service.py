"""
utils/email_service.py - Centralized Resend Email Service for GetPYQ JEC.

Handles all transactional emails using the official Resend Python SDK.
Replaces previous SMTP-based EmailBackend transport.
"""

import logging
from typing import Any, Dict, List, Optional, Union

from django.conf import settings
import resend

logger = logging.getLogger(__name__)


class EmailServiceError(Exception):
    """Raised when an email fails to send and fail_silently is False."""
    pass


def send_email(
    to: Union[str, List[str]],
    subject: str,
    text: str,
    html: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[Union[str, List[str]]] = None,
    fail_silently: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Sends a transactional email via the Resend API.

    :param to: Recipient email address or list of recipient email addresses.
    :param subject: Email subject line.
    :param text: Plain text email body.
    :param html: Optional HTML email body.
    :param from_email: Optional sender address. Defaults to settings.DEFAULT_FROM_EMAIL.
    :param reply_to: Optional reply-to address or list of addresses.
    :param fail_silently: When True, suppresses exceptions and returns None on failure.
    :return: Resend API response dictionary, or None if failed silently.
    """
    api_key = getattr(settings, "RESEND_API_KEY", "") or ""
    if not api_key:
        err_msg = "Resend API key is not configured (RESEND_API_KEY is missing or empty)."
        logger.error(err_msg)
        if fail_silently:
            return None
        raise EmailServiceError(err_msg)

    resend.api_key = api_key

    sender = from_email or getattr(
        settings, "DEFAULT_FROM_EMAIL", "GetPYQ <onboarding@resend.dev>"
    )
    recipients = [to] if isinstance(to, str) else list(to)

    params: Dict[str, Any] = {
        "from": sender,
        "to": recipients,
        "subject": subject,
        "text": text,
    }
    if html:
        params["html"] = html
    if reply_to:
        params["reply_to"] = [reply_to] if isinstance(reply_to, str) else list(reply_to)

    try:
        response = resend.Emails.send(params)
        logger.info(
            "Transactional email sent successfully via Resend to %s | subject: %s",
            recipients,
            subject,
        )
        return response
    except Exception as exc:
        # Security: Log failure without leaking tokens, credentials, or API keys
        logger.error(
            "Failed to send email via Resend to %s | subject: %s | error: %s",
            recipients,
            subject,
            exc.__class__.__name__,
        )
        if fail_silently:
            return None
        raise EmailServiceError(
            f"Failed to deliver email via Resend: {exc.__class__.__name__}"
        ) from exc


# ------------------------------------------------------------------------------
# Dedicated Application Transactional Email Helpers
# ------------------------------------------------------------------------------

def send_password_reset_email(
    user_name: str,
    user_email: str,
    reset_link: str,
) -> Optional[Dict[str, Any]]:
    """
    Sends a password reset link to the user.
    fail_silently is False so caller can return appropriate status response.
    """
    subject = "Reset your GetPYQ password"
    message = (
        f"Hello {user_name},\n\n"
        f"We received a request to reset your password for your GetPYQ account.\n\n"
        f"Click the link below to reset your password:\n{reset_link}\n\n"
        f"Note: This link is valid for 5 minutes only.\n\n"
        f"If you did not request this, you can safely ignore this email.\n\n"
        f"— GetPYQ JEC Team"
    )
    return send_email(
        to=user_email,
        subject=subject,
        text=message,
        fail_silently=False,
    )


def send_verification_approved_email(
    user_name: str,
    user_email: str,
    rno: str,
    frontend_base: str,
) -> Optional[Dict[str, Any]]:
    """
    Notifies a student that their college ID verification was approved.
    """
    subject = "Student ID Verification Approved | GetPYQ JEC"
    message = (
        f"Hello {user_name},\n\n"
        f"Congratulations! Your student ID verification (Roll No: {rno}) "
        f"has been approved by the admin team.\n\n"
        f"Your account is now verified. You have full access to contribute and upload "
        f"previous-year question papers (PYQs) to GetPYQ JEC.\n\n"
        f"Start uploading here:\n"
        f"{frontend_base}/upload\n\n"
        f"Thank you for helping the student community!\n\n"
        f"— GetPYQ JEC Team"
    )
    return send_email(
        to=user_email,
        subject=subject,
        text=message,
        fail_silently=True,
    )


def send_verification_rejected_email(
    user_name: str,
    user_email: str,
    rno: str,
    reason: str,
    frontend_base: str,
) -> Optional[Dict[str, Any]]:
    """
    Notifies a student that their college ID verification was rejected with a reason.
    """
    subject = "Student ID Verification Update | GetPYQ JEC"
    message = (
        f"Hello {user_name},\n\n"
        f"Your student ID verification submission (Roll No: {rno}) "
        f"was reviewed by the admin team and could not be approved.\n\n"
        f"Reason for rejection:\n"
        f"{reason}\n\n"
        f"You can review your status and resubmit a clearer photo of your college ID card here:\n"
        f"{frontend_base}/verify\n\n"
        f"— GetPYQ JEC Team"
    )
    return send_email(
        to=user_email,
        subject=subject,
        text=message,
        fail_silently=True,
    )


def send_subject_approved_email(
    user_name: str,
    user_email: str,
    code: str,
    name: str,
    branch: str,
    semester: int,
) -> Optional[Dict[str, Any]]:
    """
    Notifies a student that their unlisted subject addition request was approved.
    """
    subject = f"Subject Approved: {code} - {name} | GetPYQ JEC"
    message = (
        f"Hello {user_name},\n\n"
        f"Good news! Your request to add the subject '{code} - {name}' "
        f"for {branch}, Semester {semester} has been approved by the admin team.\n\n"
        f"This subject is now available under 'Past / Previously Taught Subjects' in the subject dropdown. "
        f"You can now upload question papers for this subject on GetPYQ JEC.\n\n"
        f"Thank you for helping keep GetPYQ comprehensive!\n\n"
        f"— GetPYQ JEC Team"
    )
    return send_email(
        to=user_email,
        subject=subject,
        text=message,
        fail_silently=True,
    )


def send_subject_rejected_email(
    user_name: str,
    user_email: str,
    code: str,
    name: str,
    branch: str,
    semester: int,
    reason: str,
) -> Optional[Dict[str, Any]]:
    """
    Notifies a student that their unlisted subject addition request was rejected with a reason.
    """
    subject = f"Subject Request Update: {code} | GetPYQ JEC"
    message = (
        f"Hello {user_name},\n\n"
        f"Your request to add the subject '{code} - {name}' "
        f"for {branch}, Semester {semester} was reviewed and not approved.\n\n"
        f"Reason for rejection:\n{reason}\n\n"
        f"If you have additional details or syllabus proof, please feel free to submit a revised request.\n\n"
        f"— GetPYQ JEC Team"
    )
    return send_email(
        to=user_email,
        subject=subject,
        text=message,
        fail_silently=True,
    )
