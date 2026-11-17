import base64
import hashlib
import os

from dotenv import load_dotenv


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"))

APP_NAME = "Ticketing A Service"
API_PREFIX = "/api"

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "ticket_system")

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret")
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))
JOB_SECRET = os.getenv("JOB_SECRET", "change-this-job-secret")

UPLOAD_DIR = os.path.join(BASE_DIR, os.getenv("UPLOAD_DIR", "uploads"))
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


def get_fernet_key():
    raw = os.getenv("FERNET_KEY", "").strip()
    if raw:
        return raw
    digest = hashlib.sha256(JWT_SECRET.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8")
