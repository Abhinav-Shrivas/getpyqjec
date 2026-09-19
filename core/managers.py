from django.contrib.auth.models import BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, rno, email, name, password=None, **extra_fields):
        if not rno:
            raise ValueError("Roll number required.")
        
        user = self.model(
            rno=rno,
            email=self.normalize_email(email),
            name=name,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, rno, email, name, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        return self.create_user(rno, email, name, password, **extra_fields)