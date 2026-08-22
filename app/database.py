from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app import config

# connect_args solo hace falta para SQLite (permite usarlo desde varios threads,
# que es como corre normalmente un servidor web). PostgreSQL no lo necesita
# y de hecho lanzaría un error si se lo pasáramos.
is_sqlite = config.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    config.DATABASE_URL,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        # PRAGMA foreign_keys es una instrucción específica de SQLite;
        # en PostgreSQL las claves foráneas ya están activas por defecto,
        # así que solo la ejecutamos si estamos usando SQLite.
        if is_sqlite:
            db.execute(text("PRAGMA foreign_keys=ON"))
        yield db
    finally:
        db.close()
