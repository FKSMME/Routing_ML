"""SQLAlchemy model for process groups."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Generator, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.engine import Engine
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.sql import sqltypes

from backend.api.config import get_settings

Base = declarative_base()


def _json_type() -> sqltypes.TypeEngine:
    """Return a JSON-compatible column type for the configured backend."""
    settings = get_settings()
    url = settings.routing_groups_database_url
    if url.startswith("sqlite"):
        return SQLiteJSON
    return sqltypes.JSON


class ProcessGroup(Base):
    """Persistence model for process groups."""

    __tablename__ = "process_groups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(128), nullable=False)
    description = Column(String(512), nullable=True)
    type = Column(String(32), nullable=False)  # "machining" or "post-process"
    owner = Column(String(255), nullable=False, index=True)
    default_columns = Column(
        MutableList.as_mutable(_json_type()), default=list, nullable=False
    )
    fixed_values = Column(
        MutableDict.as_mutable(_json_type()), default=dict, nullable=False
    )
    is_active = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("owner", "name", name="uq_process_groups_owner_name"),
        Index("ix_process_groups_updated", "updated_at"),
        Index("ix_process_groups_type", "type"),
    )


_ENGINE: Optional[Engine] = None
_SESSION_FACTORY: Optional[sessionmaker] = None


def get_engine() -> Engine:
    """Return a singleton SQLAlchemy engine for process group storage."""
    global _ENGINE
    if _ENGINE is None:
        settings = get_settings()
        url = settings.routing_groups_database_url
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        engine = create_engine(url, future=True, echo=False, connect_args=connect_args)

        if url.startswith("sqlite"):

            @event.listens_for(engine, "connect")
            def _set_sqlite_pragma(dbapi_connection, _):  # pragma: no cover
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        _ENGINE = engine
    return _ENGINE


def get_session_factory() -> sessionmaker:
    """Return a lazily constructed session factory."""
    global _SESSION_FACTORY
    if _SESSION_FACTORY is None:
        _SESSION_FACTORY = sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
            class_=Session,
            future=True,
        )
    return _SESSION_FACTORY


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def bootstrap_schema() -> None:
    """Create database tables if they are missing."""
    engine = get_engine()
    Base.metadata.create_all(engine)


def drop_schema() -> None:
    """Drop database tables for rollback scenarios."""
    engine = get_engine()
    Base.metadata.drop_all(engine)
