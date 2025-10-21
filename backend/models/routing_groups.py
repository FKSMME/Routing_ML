"""SQLAlchemy model and session helpers for routing groups."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Generator, Optional

from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, UniqueConstraint, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.sql import sqltypes
from uuid import uuid4

from backend.api.config import get_settings
from common.datetime_utils import utc_now_naive

Base = declarative_base()


def _json_type() -> sqltypes.TypeEngine:
    """Return a JSON-compatible column type."""

    return sqltypes.JSON(none_as_null=True)


class RoutingGroup(Base):
    """Persistence model for saved routing groups."""

    __tablename__ = "routing_groups"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    group_name = Column(String(64), nullable=False)
    owner = Column(String(255), nullable=False, index=True)
    item_codes = Column(
        MutableList.as_mutable(_json_type()), default=list, nullable=False
    )
    steps = Column(MutableList.as_mutable(_json_type()), default=list, nullable=False)
    erp_required = Column(Boolean, nullable=False, default=False)
    metadata_payload = Column(
        "metadata",
        MutableDict.as_mutable(_json_type()),
        default=dict,
        nullable=True,
    )
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(
        DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive
    )
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("owner", "group_name", name="uq_routing_groups_owner_name"),
        Index("ix_routing_groups_updated", "updated_at"),
    )


_ENGINE: Optional[Engine] = None
_SESSION_FACTORY: Optional[sessionmaker] = None


def get_engine() -> Engine:
    """Return a singleton SQLAlchemy engine for routing group storage."""

    global _ENGINE
    if _ENGINE is None:
        settings = get_settings()
        url = settings.routing_groups_database_url
        engine = create_engine(url, future=True, echo=False, pool_pre_ping=True)
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
