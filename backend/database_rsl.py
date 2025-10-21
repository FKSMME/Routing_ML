"""Persistence layer for Rule Set Library (RSL) entities."""

from __future__ import annotations

from contextlib import contextmanager

from typing import Generator, Iterable, Optional


from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.engine import Engine
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from sqlalchemy.sql import expression, sqltypes

from backend.api.config import get_settings
from common.datetime_utils import utc_now_naive


Base = declarative_base()


def _json_type() -> sqltypes.TypeEngine:
    """Return a JSON-compatible column type."""

    return sqltypes.JSON(none_as_null=True)


class RslGroup(Base):
    """Represents a routing rule group."""

    __tablename__ = "rsl_group"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner = Column(String(255), nullable=False, index=True)
    tags = Column(MutableList.as_mutable(_json_type()), default=list, nullable=False)
    erp_required = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=expression.false(),
    )
    status = Column(String(32), nullable=False, default="draft")
    validation_errors = Column(
        MutableList.as_mutable(_json_type()), default=list, nullable=False
    )
    last_validated_at = Column(DateTime, nullable=True)
    released_at = Column(DateTime, nullable=True)
    released_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)
    updated_at = Column(
        DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False
    )

    steps = relationship(
        "RslStep",
        order_by="RslStep.sequence",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class RslStep(Base):
    """Represents an individual step within an RSL group."""

    __tablename__ = "rsl_step"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(
        Integer, ForeignKey("rsl_group.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sequence = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="draft")
    tags = Column(MutableList.as_mutable(_json_type()), default=list, nullable=False)
    config = Column(MutableDict.as_mutable(_json_type()), default=dict, nullable=False)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)
    updated_at = Column(
        DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False
    )

    group = relationship("RslGroup", back_populates="steps")
    rules = relationship(
        "RslRuleRef",
        order_by="RslRuleRef.id",
        back_populates="step",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("group_id", "sequence", name="uq_rsl_step_sequence"),
    )


class RslRuleRef(Base):
    """External rule reference attached to an RSL step."""

    __tablename__ = "rsl_rule_ref"

    id = Column(Integer, primary_key=True, autoincrement=True)
    step_id = Column(
        Integer, ForeignKey("rsl_step.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_name = Column(String(255), nullable=False)
    rule_version = Column(String(64), nullable=True)
    payload = Column(
        "metadata", MutableDict.as_mutable(_json_type()), default=dict, nullable=False
    )
    is_optional = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)

    step = relationship("RslStep", back_populates="rules")

    __table_args__ = (
        UniqueConstraint("step_id", "rule_name", "rule_version", name="uq_rsl_rule_unique"),
    )


class UserAccount(Base):
    """Registered user stored in the local authentication database."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(150), nullable=False)
    normalized_username = Column(String(150), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    is_admin = Column(Boolean, nullable=False, default=False)
    must_change_password = Column(Boolean, nullable=False, default=False)
    invited_by = Column(String(150), nullable=True)
    initial_password_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now_naive, nullable=False)
    updated_at = Column(
        DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False
    )
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)


def normalize_username(username: str) -> str:
    """Normalize usernames for case-insensitive lookups."""

    return username.strip().lower()


_ENGINE: Optional[Engine] = None
_SESSION_FACTORY: Optional[sessionmaker] = None


def get_engine() -> Engine:
    """Return a singleton SQLAlchemy engine for the RSL store."""

    global _ENGINE
    if _ENGINE is None:
        settings = get_settings()
        url = settings.rsl_database_url
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
    """Create tables if they do not already exist.

    Note: For production MSSQL databases, schema creation should be handled
    by database administrators with proper permissions. This function will
    skip schema creation for MSSQL connections to avoid permission errors.
    """
    import os

    # Skip schema bootstrap in test environment
    if os.getenv("TESTING") == "true":
        return

    engine = get_engine()

    # Skip table creation for MSSQL (SQL Server) databases
    # Tables should be created by DBA with proper permissions
    if "mssql" in engine.url.drivername.lower():
        return

    # For other databases (SQLite, etc.), create tables automatically
    Base.metadata.create_all(engine)


def iter_groups(session: Session) -> Iterable[RslGroup]:
    """Yield all groups ordered by last update."""

    return (
        session.query(RslGroup)
        .order_by(RslGroup.updated_at.desc(), RslGroup.id.desc())
        .all()
    )


__all__ = [
    "Base",
    "RslGroup",
    "RslStep",
    "RslRuleRef",
    "UserAccount",
    "bootstrap_schema",
    "get_engine",
    "get_session_factory",
    "session_scope",
    "iter_groups",
    "normalize_username",
]
