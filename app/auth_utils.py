import hashlib
import os

def hash_password(password: str) -> str:
    """
    Genera un hash seguro para la contraseña provista usando PBKDF2-HMAC-SHA256 con salt aleatorio.
    Formato retornado: salt_hex$hash_hex
    """
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode('utf-8'), 
        salt.encode('utf-8'), 
        100000
    )
    return f"{salt}${key.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña corresponde al hash almacenado.
    """
    try:
        salt, key_hex = hashed_password.split('$')
        key = hashlib.pbkdf2_hmac(
            'sha256', 
            password.encode('utf-8'), 
            salt.encode('utf-8'), 
            100000
        )
        return key.hex() == key_hex
    except Exception:
        return False
