from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.core.validators import RegexValidator
from .managers import UserManager

# Create your models here.

rno_validator = RegexValidator(
    regex=r'^0201(CS|IT|AI|ME|CE|MT|IP|EE|EC)\d{6}$',
    message="Roll number must be like 0201IT231046"
)

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('contributor', 'Contributor'),
    )
    
    rno = models.CharField(
        max_length=12,
        unique=True,
        validators=[rno_validator]
        )
    
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=100)
    
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='contributor'
    )
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    date_joined = models.DateField(auto_now_add=True)
    
    USERNAME_FIELD = 'rno'
    REQUIRED_FIELDS = ['email', 'name']
    
    objects = UserManager()
    
    def get_full_name(self):
        return self.name
    
    def __str__(self):
        return self.rno

    @property
    def verification_status(self):
        """Quick access to verification status without extra queries if prefetched."""
        try:
            return self.verification.status
        except StudentVerification.DoesNotExist:
            return 'unverified'


#PYQ Model
class PYQ(models.Model):
    branch = models.CharField(max_length=10)
    semester = models.IntegerField()
    subject_code = models.CharField(max_length=20)
    year = models.IntegerField()
    exam_session = models.CharField(max_length=10)
    r2_object_key = models.CharField(max_length=255, default='')
    file_hash = models.CharField(max_length=64, blank=True, default='')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "PYQ"
        verbose_name_plural = "PYQs"
        unique_together = ('branch', 'semester', 'subject_code', 'year', 'exam_session')
        ordering = ['subject_code', 'year', 'exam_session']
        indexes = [
            models.Index(fields=['branch', 'semester', 'year'], name='pyq_lookup_idx'),
        ]
        
    def __str__(self):
        return f"{self.branch}/sem{self.semester}/{self.subject_code}/{self.year}_{self.exam_session}"


class StudentVerification(models.Model):
    """
    Tracks student ID verification lifecycle.
    Administrators manually review uploaded ID cards to approve or reject verification.
    """

    VERIFICATION_STATUS = (
        ('unverified', 'Unverified'),
        ('pending', 'Pending Review'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    )

    # ── Core verification fields ──────────────────────────────────────
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='verification'
    )
    status = models.CharField(
        max_length=20, choices=VERIFICATION_STATUS, default='unverified'
    )
    r2_object_key = models.CharField(max_length=255, blank=True, default='')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviews_given',
    )
    rejection_reason = models.TextField(blank=True, default='')

    class Meta:
        verbose_name = 'Student Verification'
        verbose_name_plural = 'Student Verifications'
        indexes = [
            models.Index(fields=['status'], name='verification_status_idx'),
        ]

    def __str__(self):
        return f"{self.user.rno} — {self.get_status_display()}"