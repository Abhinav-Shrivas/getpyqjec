import io
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

import pikepdf

from core.models import PYQ
from utils.drive import delete_pdf_from_drive, download_pdf_from_drive, upload_pdf_to_drive
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
        # Cookie should be expired/empty
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

    def test_upload_missing_fields(self):
        res = self.client.post("/upload/", {"branch": "IT"})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Missing required fields", res.data["error"])

    def test_upload_non_pdf_extension(self):
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

    def test_upload_invalid_magic_bytes(self):
        file = SimpleUploadedFile("fake.pdf", b"NOT A PDF HEADER", content_type="application/pdf")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "December",
            "file": file,
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn("not a valid PDF", res.data["error"])

    def test_upload_invalid_exam_session(self):
        file = SimpleUploadedFile("paper.pdf", self.pdf_content, content_type="application/pdf")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "August",  # invalid session
            "file": file,
        })
        self.assertEqual(res.status_code, 400)

    @patch("core.views.upload_pdf_to_drive")
    def test_upload_success(self, mock_drive_upload):
        mock_drive_upload.return_value = {
            "file_id": "test_drive_id_123",
            "download_url": "https://drive.google.com/uc?export=download&id=test_drive_id_123",
        }

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
        self.assertTrue(PYQ.objects.filter(
            branch="IT", semester=5, subject_code="IT51", year=2024, exam_session="December"
        ).exists())

    @patch("core.views.upload_pdf_to_drive")
    def test_upload_duplicate_conflict(self, mock_drive_upload):
        PYQ.objects.create(
            branch="IT",
            semester=5,
            subject_code="IT51",
            year=2024,
            exam_session="December",
            drive_file_id="existing_id",
            drive_download_url="https://drive.google.com/test",
            uploaded_by=self.user,
        )

        file = SimpleUploadedFile("paper.pdf", self.pdf_content, content_type="application/pdf")
        res = self.client.post("/upload/", {
            "branch": "IT",
            "semester": 5,
            "subject_code": "IT51",
            "year": 2024,
            "exam_session": "December",
            "file": file,
        })

        self.assertEqual(res.status_code, 409)
        mock_drive_upload.assert_not_called()

    @patch("core.views.delete_pdf_from_drive")
    @patch("core.views.upload_pdf_to_drive")
    def test_upload_db_failure_cleans_up_drive(self, mock_drive_upload, mock_drive_delete):
        mock_drive_upload.return_value = {
            "file_id": "orphan_drive_id",
            "download_url": "https://drive.google.com/orphan",
        }

        with patch("core.models.PYQ.objects.create", side_effect=RuntimeError("Database write error")):
            file = SimpleUploadedFile("paper.pdf", self.pdf_content, content_type="application/pdf")
            res = self.client.post("/upload/", {
                "branch": "IT",
                "semester": 5,
                "subject_code": "IT51",
                "year": 2024,
                "exam_session": "December",
                "file": file,
            })

            self.assertEqual(res.status_code, 500)
            mock_drive_delete.assert_called_once_with("orphan_drive_id")


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

        # Seed PYQs
        self.pyq1 = PYQ.objects.create(
            branch="IT",
            semester=5,
            subject_code="IT51",
            year=2022,
            exam_session="December",
            drive_file_id="drive_id_2022",
            drive_download_url="https://drive.google.com/2022",
            uploaded_by=self.user,
        )
        self.pyq2 = PYQ.objects.create(
            branch="IT",
            semester=5,
            subject_code="IT51",
            year=2024,
            exam_session="April",
            drive_file_id="drive_id_2024",
            drive_download_url="https://drive.google.com/2024",
            uploaded_by=self.user,
        )

    def test_download_missing_params(self):
        res = self.client.get("/download/?branch=IT")
        self.assertEqual(res.status_code, 400)

    def test_download_invalid_year_range(self):
        res = self.client.get("/download/?branch=IT&semester=5&from_year=2025&to_year=2020")
        self.assertEqual(res.status_code, 400)

    def test_download_no_pyq_found(self):
        res = self.client.get("/download/?branch=CS&semester=3&subject_code=CS31&from_year=2020&to_year=2022")
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data["error"], "No PYQ found")
        self.assertEqual(data["missing_years"], [2020, 2021, 2022])

    @patch("core.views.download_pdf_from_drive")
    def test_download_success_with_missing_years(self, mock_drive_download):
        mock_drive_download.side_effect = lambda fid: io.BytesIO(self.pdf_bytes)

        # Requested 2022 to 2024. Available: 2022 and 2024. Missing: 2023.
        res = self.client.get("/download/?branch=IT&semester=5&subject_code=IT51&from_year=2022&to_year=2024")

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("IT_sem5_IT51_2022-2024.pdf", res["Content-Disposition"])
        self.assertEqual(res.get("X-missing_years"), "2023")

    @patch("core.views.download_pdf_from_drive")
    def test_download_all_subjects(self, mock_drive_download):
        mock_drive_download.side_effect = lambda fid: io.BytesIO(self.pdf_bytes)

        res = self.client.get("/download/?branch=IT&semester=5&subject_code=all&from_year=2022&to_year=2024")
        self.assertEqual(res.status_code, 200)
        self.assertIn("IT_sem5_ALL_2022-2024.pdf", res["Content-Disposition"])


class PdfUtilsTests(TestCase):
    def test_compile_pdfs_from_buffers(self):
        buf1 = io.BytesIO(_create_minimal_pdf_bytes())
        buf2 = io.BytesIO(_create_minimal_pdf_bytes())

        merged = compile_pdfs_from_buffers([buf1, buf2])
        self.assertIsInstance(merged, io.BytesIO)

        # Read back merged PDF to confirm page count is 2
        with pikepdf.Pdf.open(merged) as pdf:
            self.assertEqual(len(pdf.pages), 2)


class HealthCheckTests(TestCase):
    def test_health_check(self):
        client = APIClient()
        res = client.get("/health/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "healthy"})
