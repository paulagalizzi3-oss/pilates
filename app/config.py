import os

# Carpeta raíz del proyecto (donde están init_db.py y la carpeta web/).
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Archivo SQLite local: siempre dentro de la carpeta del proyecto,
# funcione en tu compu (Windows) o en cualquier otro lado.
SQLITE_PATH = os.path.join(BASE_DIR, "pilates.db")

# En tu compu (desarrollo) sigue usando SQLite si no hay DATABASE_URL definida.
# En Render (producción) vas a definir la variable de entorno DATABASE_URL
# apuntando a tu base PostgreSQL, y esta línea la va a tomar automáticamente.
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{SQLITE_PATH}"

# Render (y la mayoría de los servicios de PostgreSQL) entregan la URL con el
# prefijo "postgres://", pero SQLAlchemy moderno requiere "postgresql://".
# Esta línea corrige eso automáticamente, sin que tengas que tocar nada a mano.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "True") == "True"

# Administrador inicial. Si la base no tiene ningún administrador (por ejemplo,
# la primera vez que la app arranca en Render), se crea uno con estos datos.
# En Render se cargan como variables de entorno; nunca se escriben en el código.
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Administración")
