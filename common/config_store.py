"""워크플로우 그래프 및 런타임 설정 저장소."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import json
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional

from common.logger import get_logger
from common.sql_schema import (
    DEFAULT_POWER_QUERY_PROFILES,
    DEFAULT_SQL_OUTPUT_COLUMNS,
    ensure_default_aliases,
)

logger = get_logger("workflow.config_store")


@dataclass
class TrainerRuntimeConfig:
    """트레이너 런타임 설정."""

    similarity_threshold: float = 0.8
    trim_std_enabled: bool = True
    trim_lower_percent: float = 0.05
    trim_upper_percent: float = 0.95

    def to_dict(self) -> Dict[str, Any]:
        return {
            "similarity_threshold": self.similarity_threshold,
            "trim_std_enabled": self.trim_std_enabled,
            "trim_lower_percent": self.trim_lower_percent,
            "trim_upper_percent": self.trim_upper_percent,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrainerRuntimeConfig":
        if not data:
            return cls()
        return cls(
            similarity_threshold=float(data.get("similarity_threshold", 0.8)),
            trim_std_enabled=bool(data.get("trim_std_enabled", True)),
            trim_lower_percent=float(data.get("trim_lower_percent", 0.05)),
            trim_upper_percent=float(data.get("trim_upper_percent", 0.95)),
        )


@dataclass
class PredictorRuntimeConfig:
    """예측기 런타임 설정."""

    similarity_high_threshold: float = 0.8
    max_routing_variants: int = 4
    trim_std_enabled: bool = True
    trim_lower_percent: float = 0.05
    trim_upper_percent: float = 0.95

    def to_dict(self) -> Dict[str, Any]:
        return {
            "similarity_high_threshold": self.similarity_high_threshold,
            "max_routing_variants": self.max_routing_variants,
            "trim_std_enabled": self.trim_std_enabled,
            "trim_lower_percent": self.trim_lower_percent,
            "trim_upper_percent": self.trim_upper_percent,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PredictorRuntimeConfig":
        if not data:
            return cls()
        return cls(
            similarity_high_threshold=float(data.get("similarity_high_threshold", 0.8)),
            max_routing_variants=int(data.get("max_routing_variants", 4)),
            trim_std_enabled=bool(data.get("trim_std_enabled", True)),
            trim_lower_percent=float(data.get("trim_lower_percent", 0.05)),
            trim_upper_percent=float(data.get("trim_upper_percent", 0.95)),
        )


@dataclass
class PowerQueryProfile:
    name: str
    description: Optional[str] = None
    mapping: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "mapping": dict(self.mapping),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PowerQueryProfile":
        return cls(
            name=data.get("name", "Unnamed"),
            description=data.get("description"),
            mapping=ensure_default_aliases(data.get("mapping", {})),
        )


@dataclass
class SQLColumnConfig:
    output_columns: List[str] = field(default_factory=lambda: list(DEFAULT_SQL_OUTPUT_COLUMNS))
    column_aliases: Dict[str, str] = field(default_factory=lambda: ensure_default_aliases({}))
    available_columns: List[str] = field(default_factory=lambda: list(DEFAULT_SQL_OUTPUT_COLUMNS))
    profiles: List[PowerQueryProfile] = field(
        default_factory=lambda: [
            PowerQueryProfile(name=profile.name, description=profile.description, mapping=profile.mapping)
            for profile in DEFAULT_POWER_QUERY_PROFILES
        ]
    )
    active_profile: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "output_columns": list(self.output_columns),
            "column_aliases": dict(self.column_aliases),
            "available_columns": list(self.available_columns),
            "profiles": [profile.to_dict() for profile in self.profiles],
            "active_profile": self.active_profile,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SQLColumnConfig":
        if not data:
            data = {}
        profiles = [PowerQueryProfile.from_dict(item) for item in data.get("profiles", [])]
        if not profiles:
            profiles = [
                PowerQueryProfile(
                    name=profile.name,
                    description=profile.description,
                    mapping=profile.mapping,
                )
                for profile in DEFAULT_POWER_QUERY_PROFILES
            ]
        active_profile = data.get("active_profile") or profiles[0].name
        alias_map = ensure_default_aliases(data.get("column_aliases", {}))
        return cls(
            output_columns=data.get("output_columns") or list(DEFAULT_SQL_OUTPUT_COLUMNS),
            column_aliases=alias_map,
            available_columns=data.get("available_columns") or list(DEFAULT_SQL_OUTPUT_COLUMNS),
            profiles=profiles,
            active_profile=active_profile,
        )


@dataclass
class WorkflowGraphConfig:
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    edges: List[Dict[str, Any]] = field(default_factory=list)
    design_refs: List[str] = field(default_factory=lambda: [
        "main/1.jpg",
        "main/2.jpg",
        "main/3.jpg",
        "main/4.jpg",
    ])
    last_saved: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nodes": self.nodes,
            "edges": self.edges,
            "design_refs": list(self.design_refs),
            "last_saved": self.last_saved,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkflowGraphConfig":
        if not data:
            data = {}
        return cls(
            nodes=data.get("nodes", []),
            edges=data.get("edges", []),
            design_refs=data.get("design_refs", ["main/1.jpg", "main/2.jpg", "main/3.jpg", "main/4.jpg"]),
            last_saved=data.get("last_saved"),
        )


DEFAULT_CONFIG: Dict[str, Any] = {
    "graph": WorkflowGraphConfig().to_dict(),
    "trainer": TrainerRuntimeConfig().to_dict(),
    "predictor": PredictorRuntimeConfig().to_dict(),
    "sql": SQLColumnConfig().to_dict(),
    "updated_at": datetime.utcnow().isoformat(),
}


def _deep_merge(original: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    result = dict(original)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class WorkflowConfigStore:
    """JSON 기반 설정 저장소."""

    def __init__(self, path: Path | None = None):
        self.path = path or Path("config/workflow_settings.json")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._cache: Optional[Dict[str, Any]] = None
        if not self.path.exists():
            self.path.write_text(
                json.dumps(DEFAULT_CONFIG, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            self._cache = json.loads(json.dumps(DEFAULT_CONFIG))

    def _load_locked(self) -> Dict[str, Any]:
        if self._cache is None:
            if self.path.exists():
                try:
                    self._cache = json.loads(self.path.read_text(encoding="utf-8"))
                except json.JSONDecodeError:
                    logger.warning("워크플로우 설정 파일이 손상되어 기본값으로 복구합니다")
                    self._cache = json.loads(json.dumps(DEFAULT_CONFIG))
            else:
                self._cache = json.loads(json.dumps(DEFAULT_CONFIG))
        return json.loads(json.dumps(self._cache))

    def load(self) -> Dict[str, Any]:
        with self._lock:
            return self._load_locked()

    def update_config(self, patch: Dict[str, Any]) -> Dict[str, Any]:
        if not patch:
            return self.load()
        with self._lock:
            current = self._load_locked()
            merged = _deep_merge(current, patch)
            merged["updated_at"] = datetime.utcnow().isoformat()
            self.path.write_text(
                json.dumps(merged, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            self._cache = merged
            logger.info("워크플로우 설정 업데이트: keys=%s", list(patch.keys()))
            return json.loads(json.dumps(merged))

    def get_graph(self) -> WorkflowGraphConfig:
        data = self.load().get("graph", {})
        return WorkflowGraphConfig.from_dict(data)

    def get_trainer_runtime(self) -> TrainerRuntimeConfig:
        data = self.load().get("trainer", {})
        return TrainerRuntimeConfig.from_dict(data)

    def get_predictor_runtime(self) -> PredictorRuntimeConfig:
        data = self.load().get("predictor", {})
        return PredictorRuntimeConfig.from_dict(data)

    def get_sql_column_config(self) -> SQLColumnConfig:
        data = self.load().get("sql", {})
        return SQLColumnConfig.from_dict(data)

    def update_sql_column_config(self, config: SQLColumnConfig) -> Dict[str, Any]:
        return self.update_config({"sql": config.to_dict()})

    def update_graph(self, graph: WorkflowGraphConfig) -> Dict[str, Any]:
        graph.last_saved = datetime.utcnow().isoformat()
        return self.update_config({"graph": graph.to_dict()})

    def update_trainer_runtime(self, runtime: TrainerRuntimeConfig) -> Dict[str, Any]:
        return self.update_config({"trainer": runtime.to_dict()})

    def update_predictor_runtime(self, runtime: PredictorRuntimeConfig) -> Dict[str, Any]:
        return self.update_config({"predictor": runtime.to_dict()})


workflow_config_store = WorkflowConfigStore()

__all__ = [
    "workflow_config_store",
    "WorkflowConfigStore",
    "WorkflowGraphConfig",
    "TrainerRuntimeConfig",
    "PredictorRuntimeConfig",
    "SQLColumnConfig",
    "PowerQueryProfile",
]
