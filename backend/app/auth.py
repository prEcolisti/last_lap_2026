import hashlib
import hmac
import os
import secrets

# Minimal dependency-free password hashing for this starter project.
# For production, use Argon2/bcrypt and HTTPS-secured sessions.
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return salt.hex() + "$" + digest.hex()

def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 310_000)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False

def issue_token() -> str:
    return secrets.token_urlsafe(32)
