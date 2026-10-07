import os

# Carpeta raíz del proyecto (donde están init_db.py y la carpeta web/).
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Archivo SQLite local: siempre dentro de la carpeta del proyecto,
# funcione en tu compu (Windows) o en cualquier otro lado.
SQLITE_PATH = os.path.join(BASE_DIR, "pilates.db")

# En tu compu (desarrollo) sigue usando SQLite si no hay DATABASE_URL definida.
# En Render (producción) vas a definir la variable de entorno DATABASE_URL
# apuntando a tu base PostgreSQL, y esta línea la va a tomar automáticamente.
def _clean_database_url(raw: str) -> str:
    """Deja la dirección de la base lista para usar, aunque se haya pegado
    con espacios, comillas o el comando `psql` adelante (como la muestra Neon)."""
    url = (raw or "").strip()
    if url.lower().startswith("psql "):
        url = url[5:].strip()
    url = url.strip("'\"").strip()
    if not url:
        return ""
    # Render, Neon y otros entregan "postgres://" o "postgresql://". Indicamos
    # siempre el conector psycopg2 (el que está en requirements.txt): las
    # versiones nuevas de SQLAlchemy, si no se aclara, buscan otro conector.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg2://" + url[len(prefix):]
    return url


DATABASE_URL = _clean_database_url(os.getenv("DATABASE_URL", "")) or f"sqlite:///{SQLITE_PATH}"

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "True") == "True"

# Administrador inicial. Si la base no tiene ningún administrador (por ejemplo,
# la primera vez que la app arranca en Render), se crea uno con estos datos.
# En Render se cargan como variables de entorno; nunca se escriben en el código.
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Administración")
