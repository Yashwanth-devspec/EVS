"""
backend/database.py — SQLite engine and session handling with SQLAlchemy 2.
The database path can be overridden with ECORIDE_DB_PATH (tests and e2e runs use their own file).
"""
import os
from sqlalchemy import create_engine, inspect, text, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ecoride.db")
DB_PATH = os.getenv("ECORIDE_DB_PATH", DEFAULT_DB_PATH)
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Connect args check_same_thread=False allows FastAPI multi-threaded requests with SQLite
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

# SQLite concurrency: WAL mode enables simultaneous reads & writes without database locked errors
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    """FastAPI dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _add_missing_columns():
    """create_all() never alters existing tables, so add new nullable columns by hand."""
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing:
                    continue
                col_type = col.type.compile(dialect=engine.dialect)
                default = ""
                if col.default is not None and getattr(col.default, "is_scalar", False):
                    val = col.default.arg
                    if isinstance(val, bool):
                        val = int(val)
                    default = f" DEFAULT {val!r}" if not isinstance(val, str) else f" DEFAULT '{val}'"
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}{default}'))

def init_db():
    """Initializes tables in SQLite database."""
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
