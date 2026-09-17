"""
Google Drive OAuth 2.0 Refresh Token Generator for Personal @gmail.com accounts.
Allows GETPYQJEC to upload directly to personal Google Drive with 15 GB free quota.
"""

import http.server
import json
import os
import socketserver
import sys
import urllib.parse
import urllib.request
import webbrowser

PORT = 8080
REDIRECT_URI = f"http://localhost:{PORT}/"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPE = "https://www.googleapis.com/auth/drive"


class OAuthCallbackHandler(http.server.SimpleHTTPRequestHandler):
    auth_code = None

    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        if "code" in params:
            OAuthCallbackHandler.auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"""
                <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: #16a34a;">Authentication Successful!</h2>
                    <p>You can close this tab and return to your terminal.</p>
                </body>
                </html>
            """)
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"No authorization code received.")

    def log_message(self, format, *args):
        # Suppress server logging to keep terminal clean
        return


def exchange_code_for_tokens(client_id, client_secret, code):
    data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    req = urllib.request.Request(
        TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data.get("refresh_token")
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"\n[ERROR] Failed to exchange code for token: {error_body}")
        sys.exit(1)


def main():
    print("=" * 65)
    print("  GETPYQJEC — Google Drive OAuth 2.0 Token Generator")
    print("=" * 65)
    print("This will link your personal Gmail (e.g. getpyqjec@gmail.com)")
    print("so you can upload PYQ PDFs with your 15 GB personal quota.\n")

    client_id = input("Enter your OAuth 2.0 Client ID: ").strip()
    if not client_id:
        print("[ERROR] Client ID is required.")
        sys.exit(1)

    client_secret = input("Enter your OAuth 2.0 Client Secret: ").strip()
    if not client_secret:
        print("[ERROR] Client Secret is required.")
        sys.exit(1)

    auth_params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
    })
    auth_link = f"{AUTH_URL}?{auth_params}"

    print("\n" + "-" * 65)
    print("Opening browser for authorization...")
    print(f"If the browser does not open automatically, visit this URL:\n\n{auth_link}\n")
    print("-" * 65)
    print(f"Waiting for authorization on {REDIRECT_URI}...")

    webbrowser.open(auth_link)

    with socketserver.TCPServer(("localhost", PORT), OAuthCallbackHandler) as httpd:
        httpd.handle_request()

    code = OAuthCallbackHandler.auth_code
    if not code:
        print("\n[ERROR] Did not receive authorization code.")
        sys.exit(1)

    print("[*] Authorization code received! Exchanging for refresh token...")
    refresh_token = exchange_code_for_tokens(client_id, client_secret, code)

    if not refresh_token:
        print("\n[WARN] No refresh token returned. (If you already authorized this app, go to https://myaccount.google.com/permissions to revoke access and re-run).")
        sys.exit(1)

    print("\n" + "=" * 65)
    print("  SUCCESS! REFRESH TOKEN GENERATED")
    print("=" * 65)
    print(f"\nGOOGLE_DRIVE_CLIENT_ID={client_id}")
    print(f"GOOGLE_DRIVE_CLIENT_SECRET={client_secret}")
    print(f"GOOGLE_DRIVE_REFRESH_TOKEN={refresh_token}\n")

    # Update .env
    env_file = ".env"
    if os.path.exists(env_file):
        with open(env_file, "r") as f:
            content = f.read()

        # Append or update values
        lines = content.splitlines()
        keys_to_set = {
            "GOOGLE_DRIVE_CLIENT_ID": client_id,
            "GOOGLE_DRIVE_CLIENT_SECRET": client_secret,
            "GOOGLE_DRIVE_REFRESH_TOKEN": refresh_token,
        }

        updated_lines = []
        existing_keys = set()
        for line in lines:
            if "=" in line and not line.strip().startswith("#"):
                key = line.split("=")[0].strip()
                if key in keys_to_set:
                    updated_lines.append(f"{key}={keys_to_set[key]}")
                    existing_keys.add(key)
                    continue
            updated_lines.append(line)

        for key, val in keys_to_set.items():
            if key not in existing_keys:
                updated_lines.append(f"{key}={val}")

        with open(env_file, "w") as f:
            f.write("\n".join(updated_lines) + "\n")

        print(f"[*] Updated {env_file} with your OAuth credentials.")

    print("\nYou can now run: python test_gdrive_live.py")
    print("=" * 65)


if __name__ == "__main__":
    main()
