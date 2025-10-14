"""Persistence layer for Rule Set Library (RSL) entities."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime

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
    event,
    inspect,
    text,
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.engine import Engine
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from sqlalchemy.sql import expression, sqltypes

from backend.api.config import get_settings


Base = declarative_base()


def _json_type() -> sqltypes.TypeEngine:
    """Return a JSON-compatible column type for the active backend."""

    settings = get_settings()
    if settings.rsl_database_url.startswith("sqlite"):
        return SQLiteJSON
    return sqltypes.JSON


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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
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
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        engine = create_engine(url, future=True, echo=False, connect_args=connect_args)

        if url.startswith("sqlite"):

            @event.listens_for(engine, "connect")
            def _set_sqlite_pragma(dbapi_connection, _: int) -> None:  # pragma: no cover
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
    """Create tables if they do not already exist."""

    engine = get_engine()
    Base.metadata.create_all(engine)

    with engine.begin() as conn:
        inspector = inspect(conn)

        # Migrate rsl_group: add erp_required column if missing
        rsl_group_columns = {column["name"] for column in inspector.get_columns("rsl_group")}
        if "erp_required" not in rsl_group_columns:
            conn.execute(
                text(
                    "ALTER TABLE rsl_group ADD COLUMN erp_required BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )

        # Migrate users: add full_name and email columns if missing
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "full_name" not in user_columns:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN full_name VARCHAR(255) NULL"
                )
            )
        if "email" not in user_columns:
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL"
                )
            )


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

