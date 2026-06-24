import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from core.env import load_robust_env

load_robust_env()

# Auto-detect database: use SQLite locally if PostgreSQL isn't available
_pg_url = os.getenv("DATABASE_URL", "")
if not _pg_url or "postgresql" not in _pg_url:
    # SQLite fallback for local dev without PostgreSQL
    _db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reguvigil_local.db")
    DATABASE_URL = f"sqlite+aiosqlite:///{_db_path}"
    print(f"[DB] Using SQLite: {_db_path}")
else:
    DATABASE_URL = _pg_url
    print(f"[DB] Using PostgreSQL: {_pg_url[:40]}...")

# SQLite needs check_same_thread=False; PostgreSQL doesn't need it
_engine_kwargs = {"echo": False}
if DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
