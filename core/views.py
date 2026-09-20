import hashlib
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import BytesIO

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
from django.db import transaction
from django.http import FileResponse, JsonResponse
from django.shortcuts import render
from django.template.exceptions import TemplateDoesNotExist
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from utils.pdf import compile_pdfs_from_buffers
from utils.r2_storage import (
    R2NoSuchKeyError,
    R2StorageError,
    get_pyq_storage,
    get_verification_storage,
)

from .models import PYQ, StudentVerification
from .permissions import IsAdminUser, IsVerifiedStudent
from .serializers import (
    RegisterSerializer,
    VerificationAdminDetailSerializer,
    VerificationAdminListSerializer,
    VerificationStatusSerializer,
)

logger = logging.getLogger(__name__)

User = get_user_model()
token_generator = PasswordResetTokenGenerator()

MAX_PDF_SIZE_MB = 10


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_verification_status(user):
    """Get the user's verification status string."""
    try:
        return user.verification.status
    except StudentVerification.DoesNotExist:
        return 'unverified'


def _user_response_data(user):
    """Standard user data dict included in auth responses."""
    return {
        'rno': user.rno,
        'email': user.email,
        'name': user.name,
        'role': user.role,
        'verification_status': _get_verification_status(user),
    }


def _set_refresh_cookie(response, refresh_token):
    is_production = not settings.DEBUG
    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=is_production,
        samesite="None" if is_production else "Lax",
        path="/",
    )


def _delete_refresh_cookie(response):
    is_production = not settings.DEBUG
    response.delete_cookie(
        key="refresh_token",
        path="/",
        samesite="None" if is_production else "Lax",
    )


def react_app(request):
    try:
        return render(request, "index.html")
    except TemplateDoesNotExist:
        return JsonResponse({
            "status": "healthy",
            "message": "GetPYQ JEC API is running.",
            "endpoints": {
                "auth": "/auth/",
                "upload": "/upload/",
                "download": "/download/",
                "admin": "/admin/",
            },
        })


# ─── Health Check ─────────────────────────────────────────────────────────────

class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return JsonResponse({"status": "healthy"})


# ─── Authentication ───────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        response = Response({
            "access": str(refresh.access_token),
            "user": _user_response_data(user),
        }, status=status.HTTP_201_CREATED)

        _set_refresh_cookie(response, refresh)
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        rno = request.data.get("rno")
        password = request.data.get("password")

        user = authenticate(request, username=rno, password=password)

        if user is None:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)

        response = Response(
            {
                "access": str(refresh.access_token),
                "user": _user_response_data(user),
            },
            status=status.HTTP_200_OK,
        )

        _set_refresh_cookie(response, refresh)
        return response


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response({"error": "No refresh token"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            refresh = RefreshToken(refresh_token)
            access = str(refresh.access_token)
            return Response({"access": access}, status=status.HTTP_200_OK)
        except TokenError as e:
            logger.warning(f"TokenError on refresh: {e}")
            return Response({"error": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"message": "Logged out"}, status=status.HTTP_200_OK)
        _delete_refresh_cookie(response)
        return response


# ─── PYQ Upload (R2) ─────────────────────────────────────────────────────────

class UploadPYQView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedStudent]

    def post(self, request):
        branch = request.POST.get("branch")
        semester = request.POST.get("semester")
        subject_code = request.POST.get("subject_code")
        year = request.POST.get("year")
        exam_session = request.POST.get("exam_session")
        file = request.FILES.get("file")

        if not all([branch, semester, subject_code, year, exam_session, file]):
            return Response(
                {"error": "Missing required fields"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not file.name.lower().endswith(".pdf"):
            return Response(
                {"error": "Only PDF files are allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.size > MAX_PDF_SIZE_MB * 1024 * 1024:
            return Response(
                {"error": f"PDF exceeds {MAX_PDF_SIZE_MB}MB limit"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            branch = branch.strip().upper()
            semester = int(semester)
            subject_code = subject_code.strip().upper()
            year = int(year)
            exam_session = exam_session.strip().capitalize()
            if exam_session not in ("April", "December"):
                raise ValueError("Exam session must be 'April' or 'December'")
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if PYQ.objects.filter(
            branch=branch,
            semester=semester,
            subject_code=subject_code,
            year=year,
            exam_session=exam_session,
        ).exists():
            return Response(
                {"error": "PYQ already exists for this subject/year/session"},
                status=status.HTTP_409_CONFLICT,
            )

        # Validate PDF magic header
        file_bytes = file.read()
        if not file_bytes.startswith(b"%PDF"):
            return Response(
                {"error": "Invalid file format. File content is not a valid PDF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate opaque object key and file hash
        object_key = f"pyqs/{branch}/{uuid.uuid4().hex}.pdf"
        file_hash = hashlib.sha256(file_bytes).hexdigest()

        # Upload to R2
        try:
            storage = get_pyq_storage()
            storage.upload_object(
                key=object_key,
                data=file_bytes,
                content_type="application/pdf",
            )
        except R2StorageError as e:
            logger.error(f"R2 upload error: {e}")
            return Response(
                {"error": "File storage upload failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Save metadata to database with cleanup on failure
        try:
            pyq = PYQ.objects.create(
                branch=branch,
                semester=semester,
                subject_code=subject_code,
                year=year,
                exam_session=exam_session,
                r2_object_key=object_key,
                file_hash=file_hash,
                uploaded_by=request.user,
            )
        except Exception as db_err:
            logger.error(f"Database error saving PYQ: {db_err}. Cleaning up R2 object {object_key}.")
            try:
                storage.delete_object(object_key)
            except Exception as cleanup_err:
                logger.error(f"Failed to cleanup orphaned R2 object {object_key}: {cleanup_err}")

            return Response(
                {"error": "Failed to save PYQ record in database."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"success": True, "id": pyq.id},
            status=status.HTTP_201_CREATED,
        )


# ─── PYQ Download (R2 presigned URLs) ────────────────────────────────────────

class DownloadPYQView(APIView):
    permission_classes = [AllowAny]

    MAX_PDFS_PER_MERGE = 10

    def get(self, request):
        branch = request.GET.get("branch")
        semester = request.GET.get("semester")
        subject_code = request.GET.get("subject_code", "all")
        from_year = request.GET.get("from_year")
        to_year = request.GET.get("to_year")

        if not all([branch, semester, from_year, to_year]):
            return JsonResponse(
                {"error": "Missing required parameters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            semester = int(semester)
            from_year = int(from_year)
            to_year = int(to_year)
        except ValueError:
            return JsonResponse(
                {"error": "Invalid year or semester"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if from_year > to_year:
            return JsonResponse(
                {"error": "from_year cannot be greater than to_year"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Query database for matching PYQs
        queryset = (
            PYQ.objects.filter(
                branch=branch.upper(),
                semester=semester,
                year__gte=from_year,
                year__lte=to_year,
            )
            .exclude(r2_object_key="")
            .filter(r2_object_key__isnull=False)
        )

        if subject_code.lower() != "all":
            queryset = queryset.filter(subject_code=subject_code.upper())

        pyqs = list(
            queryset.only("r2_object_key", "year", "subject_code", "exam_session")
            .order_by("subject_code", "year", "exam_session")
        )

        all_years = set(range(from_year, to_year + 1))

        if not pyqs:
            return JsonResponse(
                {
                    "error": "PYQ missing",
                    "missing_years": sorted(all_years),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if len(pyqs) > self.MAX_PDFS_PER_MERGE:
            return JsonResponse(
                {
                    "error": f"Too many PDFs ({len(pyqs)}). Maximum {self.MAX_PDFS_PER_MERGE} per download.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Download PDFs from R2 and merge
        try:
            storage = get_pyq_storage()

            def _download(pyq):
                try:
                    buf = storage.download_object(pyq.r2_object_key)
                    return (pyq, buf, None)
                except R2NoSuchKeyError as e:
                    logger.warning(
                        f"R2 object missing for PYQ id={pyq.id}, key='{pyq.r2_object_key}': {e}"
                    )
                    return (pyq, None, "missing")
                except Exception as e:
                    err_str = str(e).lower()
                    if "nosuchkey" in err_str or "not exist" in err_str or "404" in err_str:
                        logger.warning(
                            f"R2 object missing for PYQ id={pyq.id}, key='{pyq.r2_object_key}': {e}"
                        )
                        return (pyq, None, "missing")
                    logger.error(
                        f"Failed to download PYQ id={pyq.id}, key='{pyq.r2_object_key}': {e}",
                        exc_info=True,
                    )
                    return (pyq, None, "error")

            max_workers = min(len(pyqs), 5)
            if max_workers > 1:
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    download_results = list(executor.map(_download, pyqs))
            else:
                download_results = [_download(pyqs[0])]

            valid_buffers = []
            successful_pyqs = []
            for pyq, buf, status_flag in download_results:
                if buf is not None:
                    valid_buffers.append(buf)
                    successful_pyqs.append(pyq)

            # If all requested PYQs were missing in R2 or failed to download
            if not valid_buffers:
                logger.warning(
                    f"No PYQ files could be retrieved from R2 for branch={branch}, "
                    f"semester={semester}, subject_code={subject_code}, "
                    f"years={from_year}-{to_year}"
                )
                return JsonResponse(
                    {
                        "error": "PYQ missing",
                        "missing_years": sorted(all_years),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            merged_pdf = compile_pdfs_from_buffers(valid_buffers)
        except Exception as e:
            err_str = str(e).lower()
            if "nosuchkey" in err_str or "not exist" in err_str or "404" in err_str:
                return JsonResponse(
                    {
                        "error": "PYQ missing",
                        "missing_years": sorted(all_years),
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            logger.error(f"Download/Merge failed: {e}", exc_info=True)
            return JsonResponse(
                {"error": "Failed to merge PDF files. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Calculate missing years (years not in DB + years missing in R2)
        found_years = {p.year for p in successful_pyqs}
        missing_years = sorted(all_years - found_years)

        filename = f"{branch.upper()}_sem{semester}_{subject_code.upper()}_{from_year}-{to_year}.pdf"
        response = FileResponse(
            merged_pdf,
            as_attachment=True,
            filename=filename,
            content_type="application/pdf",
        )

        if missing_years:
            response["X-missing_years"] = ",".join(str(y) for y in missing_years)

        return response


# ─── Password Reset ──────────────────────────────────────────────────────────

class RequestPasswordResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email or not str(email).strip():
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = str(email).strip()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            logger.warning(f"Password reset requested for unregistered email: {email}")
            return Response(
                {"message": "If an account exists with this email, a reset link has been sent. The link is valid for 5 minutes only."},
                status=status.HTTP_200_OK,
            )

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = token_generator.make_token(user)

        frontend_base = getattr(settings, "FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
        reset_link = f"{frontend_base}/reset-password/{uid}/{token}"

        try:
            send_mail(
                subject="Reset your GetPYQ password",
                message=(
                    f"Hello {user.name},\n\n"
                    f"We received a request to reset your password for your GetPYQ account.\n\n"
                    f"Click the link below to reset your password:\n{reset_link}\n\n"
                    f"Note: This link is valid for 5 minutes only.\n\n"
                    f"If you did not request this, you can safely ignore this email.\n\n"
                    f"— GetPYQ JEC Team"
                ),
                from_email=None,
                recipient_list=[user.email],
                fail_silently=False,
            )
            logger.info(f"Password reset email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send password reset email to {user.email}: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to send password reset email: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"message": "If an account exists with this email, a reset link has been sent. The link is valid for 5 minutes only."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, uid, token):
        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"error": "Invalid link"}, status=status.HTTP_400_BAD_REQUEST)

        if not token_generator.check_token(user, token):
            return Response({"error": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)

        new_password = request.data.get("password")
        if not new_password:
            return Response({"error": "Password required"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        return Response({"message": "Password reset successful"}, status=status.HTTP_200_OK)


# ─── Student Verification ────────────────────────────────────────────────────

class VerificationStatusView(APIView):
    """GET — Returns current user's verification status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            verification = request.user.verification
        except StudentVerification.DoesNotExist:
            return Response({
                'status': 'unverified',
                'submitted_at': None,
                'reviewed_at': None,
                'rejection_reason': '',
            })

        serializer = VerificationStatusSerializer(verification)
        return Response(serializer.data)


class VerificationSubmitView(APIView):
    """
    POST — Upload ID card image, store in R2, set status='pending'.

    NEVER sets status to 'verified'. An administrator manually reviews the submission.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Check if user already has a pending or verified submission
        try:
            existing = user.verification
            if existing.status == 'verified':
                return Response(
                    {'error': 'Your account is already verified.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if existing.status == 'pending':
                return Response(
                    {'error': 'You already have a pending verification submission.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except StudentVerification.DoesNotExist:
            existing = None

        # Validate file
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'ID card image is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = settings.VERIFICATION_MAX_IMAGE_SIZE_MB * 1024 * 1024
        if file.size > max_size:
            return Response(
                {'error': f'Image exceeds {settings.VERIFICATION_MAX_IMAGE_SIZE_MB}MB limit.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file.content_type not in settings.VERIFICATION_ALLOWED_IMAGE_TYPES:
            return Response(
                {'error': 'Only JPEG and PNG images are allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Read and validate actual image content
        file_bytes = file.read()
        if not self._validate_image_content(file_bytes):
            return Response(
                {'error': 'File content is not a valid image.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate opaque R2 key (no PII in key)
        object_key = f"verification/{uuid.uuid4().hex}"

        # Upload to private R2 verification bucket
        try:
            storage = get_verification_storage()
            storage.upload_object(
                key=object_key,
                data=file_bytes,
                content_type=file.content_type,
            )
        except R2StorageError as e:
            logger.error(f"Verification image upload failed: {e}")
            return Response(
                {'error': 'Failed to upload verification image. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        now = datetime.now(timezone.utc)

        # Create or update verification record
        # Status is ALWAYS 'pending' — NEVER 'verified'
        verification_data = {
            'status': 'pending',
            'r2_object_key': object_key,
            'submitted_at': now,
            'reviewed_at': None,
            'reviewed_by': None,
            'rejection_reason': '',
        }

        if existing:
            # Delete old R2 object if exists
            old_key = existing.r2_object_key
            if old_key and old_key != object_key:
                try:
                    storage.delete_object(old_key)
                except R2StorageError:
                    logger.warning(f"Failed to delete old verification image: {old_key}")

            for attr, value in verification_data.items():
                setattr(existing, attr, value)
            existing.save()
            verification = existing
        else:
            verification = StudentVerification.objects.create(
                user=user,
                **verification_data,
            )

        return Response({
            'message': (
                'Your ID card has been submitted successfully and is pending '
                'manual verification by an administrator.'
            ),
            'status': verification.status,
        }, status=status.HTTP_201_CREATED)

    @staticmethod
    def _validate_image_content(file_bytes: bytes) -> bool:
        """Validate actual image content using Pillow — don't trust MIME type."""
        try:
            from PIL import Image
            img = Image.open(BytesIO(file_bytes))
            img.verify()
            return img.format in ('JPEG', 'PNG')
        except Exception:
            return False


class VerificationResubmitView(APIView):
    """POST — Resubmit after rejection."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        try:
            verification = user.verification
        except StudentVerification.DoesNotExist:
            return Response(
                {'error': 'No verification record found. Please submit first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if verification.status != 'rejected':
            return Response(
                {'error': f'Resubmission is only allowed for rejected verifications. Current status: {verification.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delegate to the submit view logic
        return VerificationSubmitView().post(request)


# ─── Admin Verification Management ───────────────────────────────────────────

class VerificationListView(APIView):
    """GET — List verification submissions with filtering and pagination. Admin only."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        queryset = StudentVerification.objects.select_related('user', 'reviewed_by').all()

        # Filter by status
        status_filter = request.GET.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Search by roll number, name, or email
        search = request.GET.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(user__rno__icontains=search) |
                Q(user__name__icontains=search) |
                Q(user__email__icontains=search)
            )

        # Order by most recent submissions first
        queryset = queryset.order_by('-submitted_at')

        # Pagination
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size

        verifications = queryset[start:end]
        serializer = VerificationAdminListSerializer(verifications, many=True)

        return Response({
            'results': serializer.data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
        })


class VerificationDetailView(APIView):
    """GET — Verification detail with presigned image URL and OCR results. Admin only."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, pk):
        try:
            verification = StudentVerification.objects.select_related(
                'user', 'reviewed_by'
            ).get(pk=pk)
        except StudentVerification.DoesNotExist:
            return Response(
                {'error': 'Verification not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = VerificationAdminDetailSerializer(verification)
        data = serializer.data

        # Generate short-lived presigned URL for image access
        if verification.r2_object_key:
            try:
                storage = get_verification_storage()
                data['image_url'] = storage.generate_presigned_download_url(
                    verification.r2_object_key,
                    expiry=900,  # 15 minutes for admin review
                )
            except R2StorageError:
                data['image_url'] = None
                data['image_error'] = 'Failed to generate image access URL.'
        else:
            data['image_url'] = None

        return Response(data)


class VerificationApproveView(APIView):
    """
    POST — THE ONLY PATH to set status='verified'. Admin only.

    This is the sole approval mechanism in the entire system.
    OCR cannot call this. Students cannot call this. Only admins.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                verification = (
                    StudentVerification.objects
                    .select_for_update()
                    .select_related('user')
                    .get(pk=pk)
                )

                if verification.status != 'pending':
                    return Response(
                        {'error': f'Cannot approve a submission with status: {verification.status}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                verification.status = 'verified'
                verification.reviewed_at = datetime.now(timezone.utc)
                verification.reviewed_by = request.user
                verification.rejection_reason = ''
                verification.save()

        except StudentVerification.DoesNotExist:
            return Response(
                {'error': 'Verification not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'message': f'Verification approved for {verification.user.rno}.',
            'status': 'verified',
        })


class VerificationRejectView(APIView):
    """POST — Reject verification with reason. Admin only."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'error': 'Rejection reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                verification = (
                    StudentVerification.objects
                    .select_for_update()
                    .select_related('user')
                    .get(pk=pk)
                )

                if verification.status not in ('pending', 'verified'):
                    return Response(
                        {'error': f'Cannot reject a submission with status: {verification.status}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                verification.status = 'rejected'
                verification.reviewed_at = datetime.now(timezone.utc)
                verification.reviewed_by = request.user
                verification.rejection_reason = reason
                verification.save()

        except StudentVerification.DoesNotExist:
            return Response(
                {'error': 'Verification not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'message': f'Verification rejected for {verification.user.rno}.',
            'status': 'rejected',
            'reason': reason,
        })


class VerificationDeleteDocumentView(APIView):
    """DELETE — Delete verification document from R2 storage. Admin only."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def delete(self, request, pk):
        try:
            verification = StudentVerification.objects.get(pk=pk)
        except StudentVerification.DoesNotExist:
            return Response(
                {'error': 'Verification not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not verification.r2_object_key:
            return Response(
                {'error': 'No document to delete.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        object_key = verification.r2_object_key

        try:
            storage = get_verification_storage()
            storage.delete_object(object_key)
        except R2StorageError as e:
            logger.error(f"Failed to delete verification document {object_key}: {e}")
            return Response(
                {'error': 'Failed to delete document from storage.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        verification.r2_object_key = ''
        verification.save(update_fields=['r2_object_key'])

        return Response({
            'message': f'Verification document deleted for {verification.user.rno}.',
        })


class ExistingPYQOptionsView(APIView):
    """
    GET /upload/existing-options/?branch=IT&semester=6&subject_code=IT62
    Returns existing PYQs for the branch and semester (and optional subject_code).
    Used by the upload form to omit options where data is already available.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        branch = request.GET.get("branch", "").strip().upper()
        semester = request.GET.get("semester", "").strip()
        subject_code = request.GET.get("subject_code", "").strip().upper()

        if not branch or not semester:
            return Response({"existing": []})

        try:
            semester = int(semester)
        except ValueError:
            return Response({"existing": []})

        queryset = (
            PYQ.objects.filter(branch=branch, semester=semester)
            .exclude(r2_object_key="")
            .filter(r2_object_key__isnull=False)
        )

        if subject_code and subject_code.lower() != "all":
            queryset = queryset.filter(subject_code=subject_code)

        existing = list(queryset.values("subject_code", "year", "exam_session"))
        return Response({"existing": existing})