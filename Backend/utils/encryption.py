from cryptography.fernet import Fernet
from cryptography.fernet import InvalidToken
import os
import base64

cipher_suite = None
ENCRYPTION_KEY_LOADED = False

try:
    raw_key = os.getenv("ENCRYPTION_KEY")
    if not raw_key:
        print("Encryption: ENCRYPTION_KEY not set. Encryption/Decryption will fail.")
    else:
        ENCRYPTION_KEY_BYTES = raw_key.encode('utf-8')
        if len(raw_key) != 44 or not all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=' for c in raw_key):
            print(f"Encryption: Invalid Fernet key format: '{raw_key[:10]}...'")
        cipher_suite = Fernet(ENCRYPTION_KEY_BYTES)
        ENCRYPTION_KEY_LOADED = True
        print(f"Encryption: Fernet initialized. Key: '{raw_key[:10]}...'")
except Exception as e:
    print(f"Encryption: Failed to initialize Fernet: {e}")

def encrypt(data: str) -> str:
    """
    Encrypts a string using Fernet symmetric encryption.
    """
    if not ENCRYPTION_KEY_LOADED or cipher_suite is None:
        print("Encryption: System not initialized.")
        raise RuntimeError("Encryption system not initialized.")
    try:
        encrypted_data = cipher_suite.encrypt(data.encode('utf-8'))
        print(f"Encrypted data: '{encrypted_data.decode()[:20]}...'")
        return encrypted_data.decode('utf-8')
    except Exception as e:
        print(f"Encryption failed: {e}")
        raise

def decrypt(encrypted_data: str) -> str:
    """
    Decrypts a Fernet-encrypted string.
    """
    if not ENCRYPTION_KEY_LOADED or cipher_suite is None:
        print("Decryption: System not initialized.")
        raise RuntimeError("Decryption system not initialized.")
    if not isinstance(encrypted_data, str) or not encrypted_data:
        print(f"Decryption: Invalid input: '{encrypted_data}'")
        raise ValueError("Encrypted data must be a non-empty string.")
    try:
        print(f"Decrypting data: '{encrypted_data[:20]}...'")
        decrypted_data = cipher_suite.decrypt(encrypted_data.encode('utf-8'))
        print(f"Decrypted length: {len(decrypted_data.decode('utf-8'))}")
        return decrypted_data.decode('utf-8')
    except InvalidToken as e:
        print(f"Decryption: Invalid token: '{encrypted_data[:20]}...'")
        raise ValueError(f"Decryption failed: Invalid token. {e}")
    except Exception as e:
        print(f"Decryption error: {e}")
        raise ValueError(f"Decryption failed: {e}")