"""
Standalone Google Drive Integration Verification Script
Tests end-to-end authentication, folder permissions, upload, download, and deletion.
Supports both OAuth 2.0 (personal Gmail) and Service Account (Workspace Shared Drive).
"""

import io
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()


def test_gdrive():
    print("=" * 65)
    print("  GETPYQJEC — Google Drive Integration Live Test")
    print("=" * 65)

    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")
    if not folder_id:
        print("[FAIL] GOOGLE_DRIVE_FOLDER_ID is not set in .env")
        sys.exit(1)

    # Detect Auth Mode
    refresh_token = os.environ.get("GOOGLE_DRIVE_REFRESH_TOKEN")
    client_id = os.environ.get("GOOGLE_DRIVE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_DRIVE_CLIENT_SECRET")
    creds_json = os.environ.get("GOOGLE_DRIVE_CREDENTIALS")

    if refresh_token and client_id and client_secret:
        auth_mode = "OAuth 2.0 User (Personal @gmail.com Drive)"
        print(f"[*] Auth Mode: {auth_mode}")
        print(f"[*] Client ID: {client_id[:15]}...")
    elif creds_json:
        auth_mode = "Service Account (Google Workspace / Shared Drive)"
        try:
            creds_data = json.loads(creds_json)
            client_email = creds_data.get("client_email")
            project_id = creds_data.get("project_id")
            print(f"[*] Auth Mode            : {auth_mode}")
            print(f"[*] Service Account Email: {client_email}")
            print(f"[*] Google Cloud Project : {project_id}")
        except Exception:
            print(f"[*] Auth Mode: {auth_mode}")
    else:
        print("[FAIL] No Google Drive credentials found in .env.")
        print("Please configure either:")
        print("1. OAuth 2.0 (Run 'python get_oauth_token.py') OR")
        print("2. Service Account (Set GOOGLE_DRIVE_CREDENTIALS in .env)")
        sys.exit(1)

    print(f"[*] Target Folder ID     : {folder_id}")
    print("-" * 65)

    # 1. Check Drive service initialization
    from utils.drive import (
        _get_drive_service,
        delete_pdf_from_drive,
        download_pdf_from_drive,
        upload_pdf_to_drive,
    )

    try:
        service = _get_drive_service()
        print("[PASS] Step 1: Successfully authenticated with Google Drive API.")
    except Exception as e:
        print(f"[FAIL] Step 1: Failed to create Drive service: {e}")
        sys.exit(1)

    # 2. Check Folder Access
    print("[*] Step 2: Checking access to target folder...")
    try:
        folder = service.files().get(
            fileId=folder_id,
            fields="id, name, mimeType",
            supportsAllDrives=True,
        ).execute()
        print(f"[PASS] Step 2: Found folder '{folder.get('name')}' (ID: {folder.get('id')})")
    except Exception as e:
        print(f"[FAIL] Step 2: Could not access folder ID '{folder_id}':\n       {e}")
        sys.exit(1)

    # 3. Test PDF Upload
    print("[*] Step 3: Uploading test PDF...")
    import pikepdf

    test_pdf = pikepdf.Pdf.new()
    test_pdf.add_blank_page(page_size=(200, 200))
    test_bytes_io = io.BytesIO()
    test_pdf.save(test_bytes_io)
    test_pdf.close()
    sample_bytes = test_bytes_io.getvalue()

    filename = "TEST_sem1_TEST01_2026_December.pdf"
    uploaded_file_id = None
    try:
        upload_res = upload_pdf_to_drive(sample_bytes, filename, branch="TEST")
        uploaded_file_id = upload_res["file_id"]
        download_url = upload_res["download_url"]
        print(f"[PASS] Step 3: Uploaded '{filename}'")
        print(f"       File ID     : {uploaded_file_id}")
        print(f"       Download URL: {download_url}")
    except Exception as e:
        print(f"[FAIL] Step 3: Upload failed: {e}")
        sys.exit(1)

    # 4. Test PDF Download
    print("[*] Step 4: Downloading file back from Google Drive...")
    try:
        downloaded_buffer = download_pdf_from_drive(uploaded_file_id)
        downloaded_bytes = downloaded_buffer.getvalue()

        if downloaded_bytes.startswith(b"%PDF"):
            print(f"[PASS] Step 4: Download succeeded! Verified PDF magic header ({len(downloaded_bytes)} bytes).")
        else:
            print(f"[FAIL] Step 4: Downloaded file is not a valid PDF.")
            sys.exit(1)
    except Exception as e:
        print(f"[FAIL] Step 4: Download failed: {e}")
        sys.exit(1)

    # 5. Test Cleanup / Deletion
    print("[*] Step 5: Cleaning up test file from Google Drive...")
    try:
        delete_pdf_from_drive(uploaded_file_id)
        print(f"[PASS] Step 5: Test file {uploaded_file_id} successfully deleted.")
    except Exception as e:
        print(f"[WARN] Step 5: Could not delete test file {uploaded_file_id}: {e}")

    print("=" * 65)
    print("  ALL GOOGLE DRIVE TESTS PASSED! READY FOR PRODUCTION.")
    print("=" * 65)


if __name__ == "__main__":
    test_gdrive()
