import os

# En tu compu (desarrollo) sigue usando SQLite si no hay DATABASE_URL definida.
# En Render (producción) vas a definir la variable de entorno DATABASE_URL
# apuntando a tu base PostgreSQL, y esta línea la va a tomar automáticamente.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///C:/Users/paula/.gemini/antigravity/scratch/pilates-control-app/pilates.db",
)

# Render (y la mayoría de los servicios de PostgreSQL) entregan la URL con el
# prefijo "postgres://", pero SQLAlchemy moderno requiere "postgresql://".
# Esta línea corrige eso automáticamente, sin que tengas que tocar nada a mano.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))
DEBUG = os.getenv("DEBUG", "True") == "True"
