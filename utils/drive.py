import json
import os
from io import BytesIO
import logging
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/drive']

_DRIVE_SERVICE = None
_BRANCH_FOLDER_CACHE = {}

def _get_drive_service():
    global _DRIVE_SERVICE
    if _DRIVE_SERVICE is not None:
        return _DRIVE_SERVICE

    # 1. Prefer OAuth 2.0 User Credentials (allows uploading to personal @gmail.com Drive)
    refresh_token = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN')
    client_id = os.environ.get('GOOGLE_DRIVE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET')

    if refresh_token and client_id and client_secret:
        creds = Credentials(
            None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )
        _DRIVE_SERVICE = build('drive', 'v3', credentials=creds, cache_discovery=False)
        return _DRIVE_SERVICE

    # 2. Fall back to Service Account Credentials (for Google Workspace Shared Drives)
    creds_json = os.environ.get('GOOGLE_DRIVE_CREDENTIALS')
    if creds_json:
        creds_dict = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        _DRIVE_SERVICE = build('drive', 'v3', credentials=creds, cache_discovery=False)
        return _DRIVE_SERVICE

    raise RuntimeError(
        'Google Drive credentials not configured. Provide GOOGLE_DRIVE_REFRESH_TOKEN, '
        'GOOGLE_DRIVE_CLIENT_ID, and GOOGLE_DRIVE_CLIENT_SECRET (for personal Gmail), '
        'or GOOGLE_DRIVE_CREDENTIALS (for Service Account).'
    )

def _get_or_create_subfolder(service, parent_id: str, folder_name: str) -> str:
    """
    Finds or creates a subfolder within parent_id (e.g. for branch organization).
    Caches folder IDs in memory to avoid redundant Google Drive queries.
    Falls back gracefully to parent_id if any error occurs.
    """
    cache_key = f"{parent_id}:{folder_name}"
    if cache_key in _BRANCH_FOLDER_CACHE:
        return _BRANCH_FOLDER_CACHE[cache_key]

    try:
        query = (
            f"'{parent_id}' in parents and name='{folder_name}' and "
            f"mimeType='application/vnd.google-apps.folder' and trashed=false"
        )
        results = service.files().list(
            q=query,
            fields="files(id, name)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        files = results.get("files", [])
        if files:
            folder_id = files[0]["id"]
            _BRANCH_FOLDER_CACHE[cache_key] = folder_id
            return folder_id

        folder_metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        folder = service.files().create(
            body=folder_metadata,
            fields="id",
            supportsAllDrives=True,
        ).execute()
        folder_id = folder["id"]
        _BRANCH_FOLDER_CACHE[cache_key] = folder_id
        return folder_id
    except Exception as e:
        logger.warning(f"Could not get or create branch subfolder '{folder_name}': {e}. Using root folder.")
        return parent_id

def upload_pdf_to_drive(file_content: bytes, filename: str, branch: str = None) -> dict:
    service = _get_drive_service()
    folder_id = os.environ.get('GOOGLE_DRIVE_FOLDER_ID')
    if not folder_id:
        raise RuntimeError('GOOGLE_DRIVE_FOLDER_ID env var not set')

    target_parent = folder_id
    if not branch and '_' in filename:
        branch = filename.split('_')[0].strip().upper()
    if branch:
        target_parent = _get_or_create_subfolder(service, folder_id, branch)

    file_metadata = {'name': filename, 'parents': [target_parent]}
    media = MediaInMemoryUpload(file_content, mimetype='application/pdf')

    uploaded = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id',
        supportsAllDrives=True,
    ).execute()

    file_id = uploaded['id']

    # make publicly readable
    try:
        service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'},
            supportsAllDrives=True,
        ).execute()
    except Exception as e:
        logger.warning(f"Could not set public permission on Drive file {file_id}: {e}")

    return {
        'file_id': file_id,
        'download_url': f"https://drive.google.com/uc?export=download&id={file_id}",
    }

def download_pdf_from_drive(file_id: str) -> BytesIO:
    service = _get_drive_service()
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    buffer = BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)

    done = False
    while not done:
        _, done = downloader.next_chunk()

    buffer.seek(0)
    return buffer

def delete_pdf_from_drive(file_id: str) -> None:
    """Delete a file from Google Drive (used for rollback/cleanup when DB save fails)."""
    service = _get_drive_service()
    service.files().delete(fileId=file_id, supportsAllDrives=True).execute()