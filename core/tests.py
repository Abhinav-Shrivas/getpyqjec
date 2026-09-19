import io
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

import pikepdf
from PIL import Image

from core.models import PYQ, StudentVerification
from utils.pdf import compile_pdfs_from_buffers

User = get_user_model()


def _create_minimal_pdf_bytes():
    """Generates a valid, minimal single-page PDF in memory using pikepdf."""
    pdf = pikepdf.Pdf.new()
    pdf.add_blank_page(page_size=(200, 200))
    buf = io.BytesIO()
    pdf.save(buf)
    pdf.close()
    buf.seek(0)
    return buf.getvalue()


def _create_minimal_image_bytes():
    """Generates a valid minimal PNG image in memory."""
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.valid_rno = "0201IT231046"
        self.valid_email = "teststudent@gmail.com"
        self.valid_password = "password123"
        self.user = User.objects.create_user(
            rno=self.valid_rno,
            email=self.valid_email,
            name="Test Student",
            password=self.valid_password,
        )

    def test_user_creation_and_rno_regex(self):
        self.assertEqual(self.user.role, "contributor")
        self.assertTrue(self.user.is_active)
        self.assertFalse(self.user.is_staff)

        # Invalid roll number should fail validation
        with self.assertRaises(Exception):
            invalid_user = User(
                rno="9999XX123456",
                email="invalid@gmail.com",
                name="Invalid",
            )
            invalid_user.full_clean()

    def test_register_success(self):
        res = self.client.post("/auth/register/", {
            "rno": "0201CS231001",
            "email": "csstudent@gmail.com",
            "name": "CS Student",
            "password": "strongpassword",
        }, format="json")

        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertEqual(res.data["user"]["rno"], "0201CS231001")
        self.assertEqual(res.data["user"]["verification_status"], "unverified")
        self.assertIn("refresh_token", res.cookies)

    def test_register_duplicate_rno_or_email(self):
        res = self.client.post("/auth/register/", {
            "rno": self.valid_rno,
            "email": "another@gmail.com",
            "name": "Duplicate",
            "password": "password123",
        }, format="json")
        self.assertEqual(res.status_code, 400)

    def test_login_success(self):
        res = self.client.post("/auth/login/", {
            "rno": self.valid_rno,
            "password": self.valid_password,
        }, format="json")

        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertEqual(res.data["user"]["verification_status"], "unverified")
        self.assertIn("refresh_token", res.cookies)

    def test_login_invalid_credentials(self):
        res = self.client.post("/auth/login/", {
            "rno": self.valid_rno,
            "password": "wrongpassword",
        }, format="json")
        self.assertEqual(res.status_code, 401)

    def test_token_refresh(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies["refresh_token"] = str(refresh)

        res = self.client.post("/auth/refresh/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)

    def test_token_refresh_no_cookie(self):
        res = self.client.post("/auth/refresh/")
        self.assertEqual(res.status_code, 401)

    def test_logout(self):
        res = self.client.post("/auth/logout/")
        self.assertEqual(res.status_code, 200)
        cookie = res.cookies.get("refresh_token")
        self.assertTrue(cookie is not None)

    def test_forgot_and_reset_password_flow(self):
        # 1. Request reset link
        res = self.client.post("/auth/forgot-password/", {"email": self.valid_email}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Reset your GetPYQ password", mail.outbox[0].subject)

        # 2. Reset password with generated token
        token_gen = PasswordResetTokenGenerator()
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = token_gen.make_token(self.user)

        res_reset = self.client.post(f"/auth/reset-password/{uid}/{token}/", {
            "password": "newsecretpassword123",
        }, format="json")
        self.assertEqual(res_reset.status_code, 200)

        # 3. Verify user can login with new password
        login_res = self.client.post("/auth/login/", {
            "rno": self.valid_rno,
            "password": "newsecretpassword123",
        }, format="json")
        self.assertEqual(login_res.status_code, 200)


class UploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            rno="0201IT231046",
            email="contributor@gmail.com",
            name="Uploader",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)
        self.pdf_content = _create_minimal_pdf_bytes()

    def test_upload_requires_auth(self):
        unauth_client = APIClient()
        res = unauth_client.post("/upload/", {})
        self.assertEqual(res.status_code, 401)

    def test_upload_blocked_for_unverified_student(self):
        file = SimpleUploadedFile("paper.pdf", self.pdf_content, content_type="application/pdf")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "December",
            "file": file,
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("verify your student ID", res.data["detail"])

    @patch("core.views.get_pyq_storage")
    def test_upload_success_for_verified_student(self, mock_get_storage):
        # Verify student
        StudentVerification.objects.create(
            user=self.user,
            status="verified",
        )

        mock_storage = MagicMock()
        mock_get_storage.return_value = mock_storage

        file = SimpleUploadedFile("paper.pdf", self.pdf_content, content_type="application/pdf")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "December",
            "file": file,
        })

        self.assertEqual(res.status_code, 201)
        mock_storage.upload_object.assert_called_once()
        self.assertTrue(PYQ.objects.filter(
            branch="IT", semester=5, subject_code="IT51", year=2024, exam_session="December"
        ).exists())

    @patch("core.views.get_pyq_storage")
    def test_upload_allowed_for_admin_user(self, mock_get_storage):
        self.user.role = "admin"
        self.user.is_staff = True
        self.user.save()

        mock_storage = MagicMock()
        mock_get_storage.return_value = mock_storage

        file = SimpleUploadedFile("paper.pdf", self.pdf_content, content_type="application/pdf")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "December",
            "file": file,
        })

        self.assertEqual(res.status_code, 201)
        mock_storage.upload_object.assert_called_once()

    def test_upload_missing_fields(self):
        StudentVerification.objects.create(user=self.user, status="verified")
        res = self.client.post("/upload/", {"branch": "IT"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Missing required fields", res.data["error"])

    def test_upload_non_pdf_extension(self):
        StudentVerification.objects.create(user=self.user, status="verified")
        file = SimpleUploadedFile("paper.txt", b"plain text", content_type="text/plain")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "December",
            "file": file,
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("Only PDF files are allowed", res.data["error"])


class DownloadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            rno="0201IT231046",
            email="contributor@gmail.com",
            name="Uploader",
            password="password123",
        )
        self.pdf_bytes = _create_minimal_pdf_bytes()

        # Seed PYQs with r2_object_key
        self.pyq1 = PYQ.objects.create(
            branch="IT",
            semester=5,
            subject_code="IT51",
            year=2022,
            exam_session="December",
            r2_object_key="pyq/IT/5/IT51/2022_dec.pdf",
            uploaded_by=self.user,
        )
        self.pyq2 = PYQ.objects.create(
            branch="IT",
            semester=5,
            subject_code="IT51",
            year=2024,
            exam_session="April",
            r2_object_key="pyq/IT/5/IT51/2024_apr.pdf",
            uploaded_by=self.user,
        )

    def test_download_missing_params(self):
        res = self.client.get("/download/?branch=IT")
        self.assertEqual(res.status_code, 400)

    def test_download_no_pyq_found(self):
        res = self.client.get("/download/?branch=CS&semester=3&subject_code=CS31&from_year=2020&to_year=2022")
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data["error"], "No PYQ found")
        self.assertEqual(data["missing_years"], [2020, 2021, 2022])

    @patch("core.views.get_pyq_storage")
    def test_download_success_with_missing_years(self, mock_get_storage):
        mock_storage = MagicMock()
        mock_storage.download_object.return_value = self.pdf_bytes
        mock_get_storage.return_value = mock_storage

        res = self.client.get("/download/?branch=IT&semester=5&subject_code=IT51&from_year=2022&to_year=2024")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("IT_sem5_IT51_2022-2024.pdf", res["Content-Disposition"])
        self.assertEqual(res.get("X-missing_years"), "2023")


class StudentVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            rno="0201IT231046",
            email="student@gmail.com",
            name="Test Student",
            password="password123",
        )
        self.client.force_authenticate(user=self.user)
        self.image_bytes = _create_minimal_image_bytes()

        self.admin = User.objects.create_user(
            rno="0201AD201001",
            email="admin@gmail.com",
            name="Admin User",
            password="adminpassword",
            role="admin",
            is_staff=True,
        )

    def test_get_status_unverified(self):
        res = self.client.get("/verification/status/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "unverified")

    @patch("core.views.get_verification_storage")
    def test_submit_verification_sets_pending_never_verified(self, mock_get_storage):
        mock_storage = MagicMock()
        mock_get_storage.return_value = mock_storage

        image_file = SimpleUploadedFile("id_card.png", self.image_bytes, content_type="image/png")
        res = self.client.post("/verification/submit/", {"file": image_file})

        self.assertEqual(res.status_code, 201)
        # Verify status is strictly pending, NEVER verified automatically
        self.assertEqual(res.data["status"], "pending")

        verification = StudentVerification.objects.get(user=self.user)
        self.assertEqual(verification.status, "pending")
        self.assertTrue(verification.r2_object_key.startswith("verification/"))

    @patch("core.views.get_verification_storage")
    def test_admin_approval_workflow(self, mock_get_storage):
        verification = StudentVerification.objects.create(
            user=self.user,
            status="pending",
            r2_object_key="verification/test_doc.png",
        )

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        # Admin detail inspection
        mock_storage = MagicMock()
        mock_storage.generate_presigned_download_url.return_value = "https://r2.example.com/presigned_doc"
        mock_get_storage.return_value = mock_storage

        res_detail = admin_client.get(f"/admin-api/verifications/{verification.id}/")
        self.assertEqual(res_detail.status_code, 200)
        self.assertEqual(res_detail.data["image_url"], "https://r2.example.com/presigned_doc")

        # Admin approve
        res_approve = admin_client.post(f"/admin-api/verifications/{verification.id}/approve/")
        self.assertEqual(res_approve.status_code, 200)
        self.assertEqual(res_approve.data["status"], "verified")

        verification.refresh_from_db()
        self.assertEqual(verification.status, "verified")
        self.assertEqual(verification.reviewed_by, self.admin)

    def test_admin_reject_workflow(self):
        verification = StudentVerification.objects.create(
            user=self.user,
            status="pending",
            r2_object_key="verification/test_doc.png",
        )

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        res_reject = admin_client.post(f"/admin-api/verifications/{verification.id}/reject/", {
            "reason": "Blurry image. Roll number not legible.",
        }, format="json")

        self.assertEqual(res_reject.status_code, 200)
        self.assertEqual(res_reject.data["status"], "rejected")

        verification.refresh_from_db()
        self.assertEqual(verification.status, "rejected")
        self.assertEqual(verification.rejection_reason, "Blurry image. Roll number not legible.")

    @patch("core.views.get_verification_storage")
    def test_admin_delete_verification_document(self, mock_get_storage):
        verification = StudentVerification.objects.create(
            user=self.user,
            status="verified",
            r2_object_key="verification/stored_card.png",
        )

        mock_storage = MagicMock()
        mock_get_storage.return_value = mock_storage

        admin_client = APIClient()
        admin_client.force_authenticate(user=self.admin)

        res_del = admin_client.delete(f"/admin-api/verifications/{verification.id}/document/")
        self.assertEqual(res_del.status_code, 200)

        mock_storage.delete_object.assert_called_once_with("verification/stored_card.png")
        verification.refresh_from_db()
        self.assertEqual(verification.r2_object_key, "")
        self.assertEqual(verification.status, "verified")  # Status is retained


class ExistingPYQOptionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            rno="0201IT231046",
            email="student@gmail.com",
            name="Test Student",
            password="password123",
        )
        PYQ.objects.create(
            branch="IT",
            semester=6,
            subject_code="IT62",
            year=2025,
            exam_session="December",
            r2_object_key="pyqs/IT/test.pdf",
            uploaded_by=self.user,
        )
        # Empty key should be excluded
        PYQ.objects.create(
            branch="IT",
            semester=6,
            subject_code="IT62",
            year=2024,
            exam_session="April",
            r2_object_key="",
            uploaded_by=self.user,
        )

    def test_existing_options_filtering(self):
        res = self.client.get("/upload/existing-options/?branch=IT&semester=6")
        self.assertEqual(res.status_code, 200)
        existing = res.data["existing"]
        self.assertEqual(len(existing), 1)
        self.assertEqual(existing[0]["subject_code"], "IT62")
        self.assertEqual(existing[0]["year"], 2025)
        self.assertEqual(existing[0]["exam_session"], "December")

    def test_existing_options_with_subject(self):
        res = self.client.get("/upload/existing-options/?branch=IT&semester=6&subject_code=IT62")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["existing"]), 1)

        res_none = self.client.get("/upload/existing-options/?branch=IT&semester=6&subject_code=IT61")
        self.assertEqual(res_none.status_code, 200)
        self.assertEqual(len(res_none.data["existing"]), 0)

    def test_existing_options_missing_params(self):
        res = self.client.get("/upload/existing-options/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["existing"], [])


class PdfUtilsTests(TestCase):
    def test_compile_pdfs_from_buffers(self):
        buf1 = io.BytesIO(_create_minimal_pdf_bytes())
        buf2 = io.BytesIO(_create_minimal_pdf_bytes())

        merged = compile_pdfs_from_buffers([buf1, buf2])
        self.assertIsInstance(merged, io.BytesIO)

        with pikepdf.Pdf.open(merged) as pdf:
            self.assertEqual(len(pdf.pages), 2)


class HealthCheckTests(TestCase):
    def test_health_check(self):
        client = APIClient()
        res = client.get("/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "healthy"})
