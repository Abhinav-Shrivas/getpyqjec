from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth import get_user_model
from .models import PYQ, StudentVerification, Subject, SubjectRequest

User = get_user_model()


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "branch", "semester", "is_current", "created_at")
    list_filter = ("branch", "semester", "is_current")
    search_fields = ("code", "name", "branch")
    list_editable = ("is_current",)
    ordering = ("branch", "semester", "-is_current", "code")


@admin.register(SubjectRequest)
class SubjectRequestAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "branch", "semester", "user", "status", "submitted_at", "reviewed_by")
    list_filter = ("status", "branch", "semester")
    search_fields = ("code", "name", "user__rno", "user__name", "user__email")
    ordering = ("-submitted_at",)
    readonly_fields = ("user", "submitted_at", "reviewed_at", "reviewed_by")


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ("rno", "email", "name", "role", "verification_status_display", "is_staff")
    list_filter = ("role", "verification__status")
    fieldsets = (
        (None, {"fields": ("rno", "password")}),
        ("Personal info", {"fields": ("name", "email", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("rno", "email", "name", "role", "password1", "password2"),
        }),
    )
    search_fields = ("rno", "email")
    ordering = ("rno",)

    @admin.display(description="Verification Status")
    def verification_status_display(self, obj):
        try:
            return obj.verification.status
        except StudentVerification.DoesNotExist:
            return "unverified"


@admin.register(PYQ)
class PYQAdmin(admin.ModelAdmin):
    list_display = ('branch', 'semester', 'subject_code', 'year', 'exam_session', 'uploaded_at')
    list_filter = ('branch', 'semester', 'year')
    search_fields = ('subject_code', 'branch')
    ordering = ('subject_code', 'year')
    readonly_fields = ('r2_object_key', 'file_hash', 'uploaded_at')


@admin.register(StudentVerification)
class StudentVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'status',
        'submitted_at',
        'reviewed_by',
        'reviewed_at',
    )
    list_filter = ('status',)
    search_fields = ('user__rno', 'user__name', 'user__email')
    ordering = ('-submitted_at',)
    readonly_fields = (
        'user',
        'r2_object_key',
        'submitted_at',
        'reviewed_at',
        'reviewed_by',
    )