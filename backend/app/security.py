import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.fernet import Fernet

from . import config


PHONE_RE = re.compile(r"^1[3-9]\d{9}$")
PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\S]{8,20}$")
NAME_RE = re.compile(r"^[\u4e00-\u9fa5·]{2,20}$")

IDCARD_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
IDCARD_CODES = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"]

fernet = Fernet(config.get_fernet_key().encode("utf-8"))


def valid_phone(phone):
    return bool(PHONE_RE.fullmatch(phone))


def valid_password(password):
    return bool(PASSWORD_RE.fullmatch(password))


def valid_name(name):
    return bool(NAME_RE.fullmatch(name))


def valid_idcard(idcard):
    if not re.fullmatch(r"\d{17}[\dXx]", idcard):
        return False
    digits = idcard.upper()
    total = sum(int(digits[index]) * IDCARD_WEIGHTS[index] for index in range(17))
    return IDCARD_CODES[total % 11] == digits[-1]


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password, stored):
    salt, digest = stored.split("$", 1)
    check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return secrets.compare_digest(check, digest)


def encrypt_text(text):
    return fernet.encrypt(text.encode("utf-8")).decode("utf-8")


def decrypt_text(text):
    return fernet.decrypt(text.encode("utf-8")).decode("utf-8")


def hash_idcard(idcard):
    return hashlib.sha256(idcard.upper().encode("utf-8")).hexdigest()


def create_token(user_id, phone):
    payload = {
        "sub": str(user_id),
        "phone": phone,
        "jti": secrets.token_urlsafe(12),
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])


def mask_phone(phone):
    return f"{phone[:3]}****{phone[-4:]}" if len(phone) == 11 else phone


def mask_name(name):
    return name[:1] + "*" * max(1, len(name) - 1) if name else ""


def now_local():
    return datetime.now()

