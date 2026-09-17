import os
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from io import BytesIO

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import send_mail
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

from utils.drive import delete_pdf_from_drive, download_pdf_from_drive, upload_pdf_to_drive
from utils.pdf import compile_pdfs_from_buffers
from .models import PYQ
from .serializers import RegisterSerializer

logger = logging.getLogger(__name__)

User = get_user_model()
token_generator = PasswordResetTokenGenerator()

MAX_PDF_SIZE_MB = 10


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


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return JsonResponse({"status": "healthy"})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        response = Response({
            "access": str(refresh.access_token),
            "user": {
                "rno": user.rno,
                "email": user.email,
                "name": user.name,
                "role": user.role,
            }
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
                "user": {
                    "rno": user.rno,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                },
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


class UploadPYQView(APIView):
    permission_classes = [IsAuthenticated]

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

        # Upload to Google Drive
        filename = f"{branch}_sem{semester}_{subject_code}_{year}_{exam_session}.pdf"
        try:
            result = upload_pdf_to_drive(file_bytes, filename, branch=branch)
        except Exception as e:
            logger.error(f"Google Drive upload error: {e}", exc_info=True)
            return Response(
                {"error": f"Google Drive upload failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Save metadata to database with compensation/cleanup on failure
        try:
            pyq = PYQ.objects.create(
                branch=branch,
                semester=semester,
                subject_code=subject_code,
                year=year,
                exam_session=exam_session,
                drive_file_id=result["file_id"],
                drive_download_url=result["download_url"],
                uploaded_by=request.user,
            )
        except Exception as db_err:
            logger.error(f"Database error saving PYQ: {db_err}. Cleaning up Drive file {result['file_id']}.")
            try:
                delete_pdf_from_drive(result["file_id"])
            except Exception as cleanup_err:
                logger.error(f"Failed to cleanup orphaned Drive file {result['file_id']}: {cleanup_err}")

            return Response(
                {"error": "Failed to save PYQ record in database."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"success": True, "id": pyq.id, "file_id": pyq.drive_file_id},
            status=status.HTTP_201_CREATED,
        )


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
        queryset = PYQ.objects.filter(
            branch=branch.upper(),
            semester=semester,
            year__gte=from_year,
            year__lte=to_year,
        )

        if subject_code.lower() != "all":
            queryset = queryset.filter(subject_code=subject_code.upper())

        pyqs = list(
            queryset.only("drive_file_id", "year", "subject_code", "exam_session")
            .order_by("subject_code", "year", "exam_session")
        )

        all_years = set(range(from_year, to_year + 1))

        if not pyqs:
            return JsonResponse(
                {
                    "error": "No PYQ found",
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

        # Download PDFs from Google Drive (concurrently if multiple) and merge in memory
        try:
            max_workers = min(len(pyqs), 5)
            if max_workers > 1:
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    pdf_buffers = list(executor.map(download_pdf_from_drive, [p.drive_file_id for p in pyqs]))
            else:
                pdf_buffers = [download_pdf_from_drive(pyqs[0].drive_file_id)]
            merged_pdf = compile_pdfs_from_buffers(pdf_buffers)
        except Exception as e:
            logger.error(f"Download/Merge failed: {e}", exc_info=True)
            return JsonResponse(
                {"error": f"Merge failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Calculate missing years
        found_years = {p.year for p in pyqs}
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
                {"message": "If an account exists with this email, a reset link has been sent."},
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
            {"message": "If an account exists with this email, a reset link has been sent."},
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