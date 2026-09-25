# Generated manually for seeding initial subjects and linking existing PYQs

from django.db import migrations

def seed_subjects(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    PYQ = apps.get_model('core', 'PYQ')
    from core.curriculum import SUBJECTS, SUBJECT_CODE_TO_NAME

    SEMESTER_MAP = {
        'first': 1,
        'second': 2,
        'third': 3,
        'fourth': 4,
        'fifth': 5,
        'sixth': 6,
        'seventh': 7,
        'eighth': 8,
    }

    # 1. Seed all current subjects from curriculum definition
    for branch_key, semesters in SUBJECTS.items():
        for sem_key, subject_list in semesters.items():
            sem_num = SEMESTER_MAP.get(sem_key)
            if not sem_num:
                continue
            for name, code in subject_list:
                clean_code = str(code).strip().upper()
                clean_name = str(name).strip()
                Subject.objects.get_or_create(
                    branch=branch_key,
                    semester=sem_num,
                    code=clean_code,
                    name=clean_name,
                    defaults={'is_current': True},
                )

    # 2. Check existing PYQs and link or create past subjects
    for pyq in PYQ.objects.all():
        subj = Subject.objects.filter(
            branch=pyq.branch,
            semester=pyq.semester,
            code=pyq.subject_code,
        ).first()

        if not subj and pyq.semester <= 2:
            subj = Subject.objects.filter(
                branch='CommonForAllBranches',
                semester=pyq.semester,
                code=pyq.subject_code,
            ).first()

        if not subj:
            # Subject from an older curriculum version
            subject_name = SUBJECT_CODE_TO_NAME.get(pyq.subject_code, pyq.subject_code)
            subj, _ = Subject.objects.get_or_create(
                branch=pyq.branch,
                semester=pyq.semester,
                code=pyq.subject_code,
                name=subject_name,
                defaults={'is_current': False},
            )

        pyq.subject = subj
        pyq.save(update_fields=['subject'])

def reverse_seed(apps, schema_editor):
    Subject = apps.get_model('core', 'Subject')
    Subject.objects.all().delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_subject_pyq_subject'),
    ]

    operations = [
        migrations.RunPython(seed_subjects, reverse_seed),
    ]
