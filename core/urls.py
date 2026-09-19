from django.urls import path
from .views import (
    RegisterView,
    UploadPYQView,
    ExistingPYQOptionsView,
    DownloadPYQView,
    RequestPasswordResetView,
    ResetPasswordView,
    LoginView,
    RefreshView,
    LogoutView,
    HealthCheckView,
    VerificationStatusView,
    VerificationSubmitView,
    VerificationResubmitView,
    VerificationListView,
    VerificationDetailView,
    VerificationApproveView,
    VerificationRejectView,
    VerificationDeleteDocumentView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("upload/", UploadPYQView.as_view(), name="upload_pyq"),
    path("upload/existing-options/", ExistingPYQOptionsView.as_view(), name="existing_pyq_options"),
    path("download/", DownloadPYQView.as_view(), name="download_pyq"),
    path("auth/forgot-password/", RequestPasswordResetView.as_view(), name="request_password_reset"),
    path("auth/reset-password/<uid>/<token>/", ResetPasswordView.as_view(), name="reset_password"),

    # Student verification endpoints
    path("verification/status/", VerificationStatusView.as_view(), name="verification_status"),
    path("verification/submit/", VerificationSubmitView.as_view(), name="verification_submit"),
    path("verification/resubmit/", VerificationResubmitView.as_view(), name="verification_resubmit"),

    # Admin verification management endpoints
    path("admin-api/verifications/", VerificationListView.as_view(), name="admin_verification_list"),
    path("admin-api/verifications/<int:pk>/", VerificationDetailView.as_view(), name="admin_verification_detail"),
    path("admin-api/verifications/<int:pk>/approve/", VerificationApproveView.as_view(), name="admin_verification_approve"),
    path("admin-api/verifications/<int:pk>/reject/", VerificationRejectView.as_view(), name="admin_verification_reject"),
    path("admin-api/verifications/<int:pk>/document/", VerificationDeleteDocumentView.as_view(), name="admin_verification_delete_document"),
]