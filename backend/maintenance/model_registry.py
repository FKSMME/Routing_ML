"""Lightweight SQLite-backed model registry utilities."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
import sqlite3
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional

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


def _dict_factory(cursor: sqlite3.Cursor, row: sqlite3.Row) -> Dict[str, object]:
    return {description[0]: row[idx] for idx, description in enumerate(cursor.description)}


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    _ensure_parent(db_path)
    connection = sqlite3.connect(db_path)
    connection.row_factory = _dict_factory
    try:
        yield connection
    finally:
        connection.close()


def initialize_schema(db_path: Path) -> None:
    """Create the registry schema if it does not yet exist."""

    with connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS model_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version_name TEXT NOT NULL UNIQUE,
                artifact_dir TEXT NOT NULL,
                manifest_path TEXT NOT NULL,
                status TEXT NOT NULL,
                active_flag INTEGER NOT NULL DEFAULT 0,
                requested_by TEXT,
                created_at TEXT NOT NULL,
                trained_at TEXT,
                activated_at TEXT,
                updated_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_model_versions_active
                ON model_versions(active_flag, activated_at DESC)
            """
        )
        conn.commit()


def _row_to_model_version(payload: Dict[str, object]) -> ModelVersion:
    return ModelVersion(
        version_name=str(payload["version_name"]),
        artifact_dir=str(payload["artifact_dir"]),
        manifest_path=str(payload["manifest_path"]),
        status=str(payload["status"]),
        active_flag=bool(payload["active_flag"]),
        requested_by=payload.get("requested_by"),
        created_at=str(payload["created_at"]),
        trained_at=payload.get("trained_at"),
        activated_at=payload.get("activated_at"),
        updated_at=payload.get("updated_at"),
    )


def register_version(
    *,
    db_path: Path,
    version_name: str,
    artifact_dir: Path,
    manifest_path: Path,
    requested_by: Optional[str],
    trained_at: Optional[datetime] = None,
) -> ModelVersion:
    """Insert a new pending model version row."""

    initialize_schema(db_path)
    created_at = utc_isoformat()
    trained_at_str = trained_at.isoformat() if trained_at else None

    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO model_versions (
                version_name,
                artifact_dir,
                manifest_path,
                status,
                active_flag,
                requested_by,
                created_at,
                trained_at,
                activated_at,
                updated_at
            ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?)
            ON CONFLICT(version_name) DO UPDATE SET
                artifact_dir = excluded.artifact_dir,
                manifest_path = excluded.manifest_path,
                status = excluded.status,
                active_flag = excluded.active_flag,
                requested_by = excluded.requested_by,
                created_at = model_versions.created_at,
                trained_at = excluded.trained_at,
                activated_at = excluded.activated_at,
                updated_at = excluded.updated_at
            """,
            (
                version_name,
                str(artifact_dir),
                str(manifest_path),
                ModelLifecycleStatus.PENDING.value,
                requested_by,
                created_at,
                trained_at_str,
                created_at,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM model_versions WHERE version_name = ?",
            (version_name,),
        ).fetchone()

    if row is None:
        raise RegistryError("모델 버전 등록에 실패했습니다")
    return _row_to_model_version(row)


def list_versions(*, db_path: Path, limit: Optional[int] = None) -> List[ModelVersion]:
    """Return versions ordered by creation date descending."""

    initialize_schema(db_path)
    query = "SELECT * FROM model_versions ORDER BY datetime(created_at) DESC, id DESC"
    params: Iterable[object]
    if limit:
        query += " LIMIT ?"
        params = (limit,)
    else:
        params = ()

    with connect(db_path) as conn:
        rows = conn.execute(query, params).fetchall()

    return [_row_to_model_version(row) for row in rows]


def get_active_version(*, db_path: Path) -> Optional[ModelVersion]:
    """Return the currently active model version, if any."""

    initialize_schema(db_path)
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT * FROM model_versions
            WHERE active_flag = 1
            ORDER BY datetime(activated_at) DESC, id DESC
            LIMIT 1
            """
        ).fetchone()

    return _row_to_model_version(row) if row else None


def activate_version(*, db_path: Path, version_name: str) -> ModelVersion:
    """Mark the provided version as active and retire the previous active version."""

    initialize_schema(db_path)
    activated_at = utc_isoformat()

    with connect(db_path) as conn:
        target = conn.execute(
            "SELECT * FROM model_versions WHERE version_name = ?",
            (version_name,),
        ).fetchone()
        if target is None:
            raise VersionNotFoundError(f"등록되지 않은 모델 버전입니다: {version_name}")

        conn.execute(
            """
            UPDATE model_versions
            SET active_flag = 0,
                status = CASE WHEN status = ? THEN ? ELSE status END,
                updated_at = ?
            WHERE active_flag = 1
            """,
            (
                ModelLifecycleStatus.ACTIVE.value,
                ModelLifecycleStatus.RETIRED.value,
                activated_at,
            ),
        )
        conn.execute(
            """
            UPDATE model_versions
            SET active_flag = 1,
                status = ?,
                activated_at = ?,
                updated_at = ?
            WHERE version_name = ?
            """,
            (
                ModelLifecycleStatus.ACTIVE.value,
                activated_at,
                activated_at,
                version_name,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM model_versions WHERE version_name = ?",
            (version_name,),
        ).fetchone()

    if row is None:
        raise RegistryError("활성화된 모델 버전을 조회할 수 없습니다")
    return _row_to_model_version(row)


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
