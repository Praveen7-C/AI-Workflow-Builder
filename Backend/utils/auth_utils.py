"""
Auth helpers using Python stdlib only (no external auth libraries).
- Password hashing via hashlib PBKDF2-HMAC-SHA256
- JWT-like tokens using HMAC-SHA256 (header.payload.signature, base64url)
"""

import os
import hashlib
import hmac
import base64
import json
import uuid
import time
from typing import Optional, Dict

# Load JWT secret from env (falls back to a default for dev)
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7  # 7 days


# Password hashing

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260_000)
    return base64.b64encode(salt + dk).decode()


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        data = base64.b64decode(stored_hash.encode())
        salt, dk_stored = data[:16], data[16:]
        dk_new = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260_000)
        return hmac.compare_digest(dk_stored, dk_new)
    except Exception:
        return False


# Minimal JWT (HS256)

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (padding % 4))


def create_access_token(user_id: str, email: str) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(json.dumps({
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }).encode())
    sig_input = f"{header}.{payload}".encode()
    signature = _b64url_encode(
        hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
    )
    return f"{header}.{payload}.{signature}"


def decode_access_token(token: str) -> Optional[Dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        expected_sig = _b64url_encode(
            hmac.new(
                JWT_SECRET.encode(),
                f"{header_b64}.{payload_b64}".encode(),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(expected_sig, sig_b64):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def get_current_user_id(authorization: Optional[str]) -> Optional[str]:
    """Extract user_id from 'Bearer <token>' header value."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    payload = decode_access_token(token)
    return payload.get("sub") if payload else None
