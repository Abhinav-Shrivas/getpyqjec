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
    

#PYQ Model
class PYQ(models.Model):
    branch = models.CharField(max_length=10)
    semester = models.IntegerField()
    subject_code = models.CharField(max_length=20)
    year = models.IntegerField()
    exam_session = models.CharField(max_length=10)
    drive_file_id = models.CharField(max_length=100)
    drive_download_url = models.URLField()
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