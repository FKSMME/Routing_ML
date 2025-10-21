"""Database-backed model registry utilities (SQLAlchemy-based)."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Iterable, Iterator, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    create_engine,
    select,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from common.datetime_utils import utc_isoformat


class RegistryError(RuntimeError):
    """Base error for registry operations."""


class VersionNotFoundError(RegistryError):
    """Raised when a requested model version cannot be found."""


class ModelLifecycleStatus(str, Enum):
    """Lifecycle states for a trained model version."""

    PENDING = "pending"
    ACTIVE = "active"
    RETIRED = "retired"


@dataclass(slots=True)
class ModelVersion:
    """Simple value object mirroring the registry schema."""

    version_name: str
    artifact_dir: str
    manifest_path: str
    status: str
    active_flag: bool
    requested_by: Optional[str]
    created_at: str
    trained_at: Optional[str]
    activated_at: Optional[str]
    updated_at: Optional[str]

    def to_dict(self) -> Dict[str, object]:
        payload = asdict(self)
        payload["active_flag"] = bool(payload["active_flag"])
        return payload


Base = declarative_base()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _dt_to_iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


class ModelVersionRecord(Base):
    """ORM representation of the model registry table."""

    __tablename__ = "model_versions"
    __table_args__ = (
        Index("ix_model_versions_version_name", "version_name", unique=True),
        Index("ix_model_versions_active_flag", "active_flag", "activated_at"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Note: index is created explicitly in __table_args__, don't add index=True here
    version_name = Column(String(128), nullable=False, unique=True)
    artifact_dir = Column(String(512), nullable=False)
    manifest_path = Column(String(512), nullable=False)
    status = Column(String(32), nullable=False, default=ModelLifecycleStatus.PENDING.value)
    active_flag = Column(Boolean, nullable=False, default=False)
    requested_by = Column(String(150), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    trained_at = Column(DateTime(timezone=True), nullable=True)
    activated_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)


_ENGINE_CACHE: Dict[str, Engine] = {}
_SESSION_FACTORY_CACHE: Dict[str, sessionmaker] = {}


def _get_engine(db_url: str) -> Engine:
    engine = _ENGINE_CACHE.get(db_url)
    if engine is None:
        engine = create_engine(db_url, future=True, pool_pre_ping=True)
        _ENGINE_CACHE[db_url] = engine
    return engine


def _get_session_factory(db_url: str) -> sessionmaker:
    factory = _SESSION_FACTORY_CACHE.get(db_url)
    if factory is None:
        factory = sessionmaker(
            bind=_get_engine(db_url),
            expire_on_commit=False,
            class_=Session,
            future=True,
        )
        _SESSION_FACTORY_CACHE[db_url] = factory
    return factory


@contextmanager
def _session_scope(db_url: str) -> Iterator[Session]:
    session = _get_session_factory(db_url)()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def initialize_schema(db_url: str) -> None:
    """Create the registry schema if it does not yet exist.

    Note: Handles duplicate table/index errors gracefully for PostgreSQL databases
    where tables or indexes may already exist from previous initialization attempts.
    SQLAlchemy's create_all() with checkfirst=True should handle this, but we add
    extra protection against race conditions and partial schema states.
    """
    from sqlalchemy.exc import ProgrammingError

    engine = _get_engine(db_url)

    try:
        # checkfirst=True makes create_all() idempotent - it only creates what doesn't exist
        Base.metadata.create_all(engine, checkfirst=True)
    except ProgrammingError as e:
        # Ignore duplicate table/index errors - schema already exists (or partially exists)
        error_msg = str(e).lower()
        if "already exists" in error_msg or "이미 있습니다" in error_msg or "duplicate" in error_msg:
            pass  # Schema already initialized (fully or partially)
        else:
            # Re-raise unexpected errors
            raise


def _record_to_model_version(record: ModelVersionRecord) -> ModelVersion:
    return ModelVersion(
        version_name=record.version_name,
        artifact_dir=record.artifact_dir,
        manifest_path=record.manifest_path,
        status=record.status,
        active_flag=bool(record.active_flag),
        requested_by=record.requested_by,
        created_at=_dt_to_iso(record.created_at) or utc_isoformat(),
        trained_at=_dt_to_iso(record.trained_at),
        activated_at=_dt_to_iso(record.activated_at),
        updated_at=_dt_to_iso(record.updated_at),
    )


def register_version(
    *,
    db_url: str,
    version_name: str,
    artifact_dir: str,
    manifest_path: str,
    requested_by: Optional[str],
    trained_at: Optional[datetime] = None,
) -> ModelVersion:
    """Insert a new pending model version row or update an existing entry."""

    initialize_schema(db_url)
    now = _now()
    trained_at_dt = _ensure_utc(trained_at)

    with _session_scope(db_url) as session:
        record = (
            session.execute(
                select(ModelVersionRecord).where(ModelVersionRecord.version_name == version_name)
            )
            .scalars()
            .first()
        )

        if record is None:
            record = ModelVersionRecord(
                version_name=version_name,
                artifact_dir=str(artifact_dir),
                manifest_path=str(manifest_path),
                status=ModelLifecycleStatus.PENDING.value,
                active_flag=False,
                requested_by=requested_by,
                created_at=now,
                trained_at=trained_at_dt,
                updated_at=now,
            )
            session.add(record)
        else:
            record.artifact_dir = str(artifact_dir)
            record.manifest_path = str(manifest_path)
            record.status = ModelLifecycleStatus.PENDING.value
            record.requested_by = requested_by
            record.trained_at = trained_at_dt
            record.updated_at = now

        session.flush()
        session.refresh(record)
        return _record_to_model_version(record)


def list_versions(*, db_url: str, limit: Optional[int] = None) -> List[ModelVersion]:
    """Return versions ordered by creation date descending."""

    initialize_schema(db_url)

    with _session_scope(db_url) as session:
        stmt = select(ModelVersionRecord).order_by(
            ModelVersionRecord.created_at.desc(),
            ModelVersionRecord.id.desc(),
        )
        if limit:
            stmt = stmt.limit(limit)
        records = session.execute(stmt).scalars().all()

    return [_record_to_model_version(record) for record in records]


def get_active_version(*, db_url: str) -> Optional[ModelVersion]:
    """Return the currently active model version, if any."""

    initialize_schema(db_url)
    with _session_scope(db_url) as session:
        record = (
            session.execute(
                select(ModelVersionRecord)
                .where(ModelVersionRecord.active_flag.is_(True))
                .order_by(ModelVersionRecord.activated_at.desc(), ModelVersionRecord.id.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )

    return _record_to_model_version(record) if record else None


def activate_version(*, db_url: str, version_name: str) -> ModelVersion:
    """Mark the provided version as active and retire the previous active version."""

    initialize_schema(db_url)
    now = _now()

    with _session_scope(db_url) as session:
        target = (
            session.execute(
                select(ModelVersionRecord).where(ModelVersionRecord.version_name == version_name)
            )
            .scalars()
            .first()
        )
        if target is None:
            raise VersionNotFoundError(f"등록되지 않은 모델 버전입니다: {version_name}")

        current_actives: Iterable[ModelVersionRecord] = (
            session.execute(
                select(ModelVersionRecord).where(ModelVersionRecord.active_flag.is_(True))
            )
            .scalars()
            .all()
        )
        for record in current_actives:
            if record.version_name == version_name:
                continue
            record.active_flag = False
            if record.status == ModelLifecycleStatus.ACTIVE.value:
                record.status = ModelLifecycleStatus.RETIRED.value
            record.updated_at = now

        target.active_flag = True
        target.status = ModelLifecycleStatus.ACTIVE.value
        target.activated_at = now
        target.updated_at = now

        session.flush()
        session.refresh(target)
        return _record_to_model_version(target)


__all__ = [
    "ModelLifecycleStatus",
    "ModelVersion",
    "RegistryError",
    "VersionNotFoundError",
    "activate_version",
    "get_active_version",
    "initialize_schema",
    "list_versions",
    "register_version",
]
