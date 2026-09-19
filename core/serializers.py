from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import StudentVerification

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ("rno", "email", "name", "password")
        
    def create(self, validated_data):
        return User.objects.create_user(
            rno=validated_data["rno"],
            email=validated_data["email"],
            name=validated_data["name"],
            password=validated_data["password"],
        )


class VerificationStatusSerializer(serializers.ModelSerializer):
    """Read-only status for the authenticated student."""

    class Meta:
        model = StudentVerification
        fields = (
            'status',
            'submitted_at',
            'reviewed_at',
            'rejection_reason',
        )
        read_only_fields = fields


class VerificationAdminListSerializer(serializers.ModelSerializer):
    """Admin list view — minimal fields for moderation queue."""

    user_rno = serializers.CharField(source='user.rno', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = StudentVerification
        fields = (
            'id',
            'user_rno',
            'user_name',
            'user_email',
            'status',
            'submitted_at',
        )
        read_only_fields = fields


class VerificationAdminDetailSerializer(serializers.ModelSerializer):
    """
    Admin detail view — student details and verification status.
    """

    user_rno = serializers.CharField(source='user.rno', read_only=True)
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    reviewed_by_rno = serializers.SerializerMethodField()

    class Meta:
        model = StudentVerification
        fields = (
            'id',
            'user_rno',
            'user_name',
            'user_email',
            'status',
            'submitted_at',
            'reviewed_at',
            'reviewed_by_rno',
            'rejection_reason',
        )
        read_only_fields = fields

    def get_reviewed_by_rno(self, obj):
        return obj.reviewed_by.rno if obj.reviewed_by else None