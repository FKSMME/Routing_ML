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
    time_profiles_enabled: bool = False
    time_profile_strategy: str = "sigma_profile"
    time_profile_optimal_sigma: float = 0.67
    time_profile_safe_sigma: float = 1.28

    def to_dict(self) -> Dict[str, Any]:
        return {
            "similarity_threshold": self.similarity_threshold,
            "trim_std_enabled": self.trim_std_enabled,
            "trim_lower_percent": self.trim_lower_percent,
            "trim_upper_percent": self.trim_upper_percent,
            "time_profiles_enabled": self.time_profiles_enabled,
            "time_profile_strategy": self.time_profile_strategy,
            "time_profile_optimal_sigma": self.time_profile_optimal_sigma,
            "time_profile_safe_sigma": self.time_profile_safe_sigma,
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
            time_profiles_enabled=bool(data.get("time_profiles_enabled", False)),
            time_profile_strategy=str(data.get("time_profile_strategy", "sigma_profile")),
            time_profile_optimal_sigma=float(data.get("time_profile_optimal_sigma", 0.67)),
            time_profile_safe_sigma=float(data.get("time_profile_safe_sigma", 1.28)),
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
        instance = cls(
            output_columns=data.get("output_columns") or list(DEFAULT_SQL_OUTPUT_COLUMNS),
            column_aliases=alias_map,
            available_columns=data.get("available_columns") or list(DEFAULT_SQL_OUTPUT_COLUMNS),
            profiles=profiles,
            active_profile=active_profile,
        )
        instance.validate_columns()
        return instance

    def validate_columns(self, allowed_columns: Optional[List[str]] = None) -> None:
        """Ensure configured columns stay within the learned/approved schema."""

        allowed = set(allowed_columns or DEFAULT_SQL_OUTPUT_COLUMNS)
        missing_in_allowed = [col for col in self.available_columns if col not in allowed]
        if missing_in_allowed:
            raise ValueError(
                "허용되지 않은 컬럼이 available_columns에 포함되어 있습니다: "
                + ", ".join(sorted(missing_in_allowed))
            )

        # output_columns must be subset of available_columns and allowed columns
        available_set = set(self.available_columns)
        invalid_output = [col for col in self.output_columns if col not in available_set]
        if invalid_output:
            raise ValueError(
                "output_columns에 허용되지 않은 컬럼이 포함되어 있습니다: "
                + ", ".join(sorted(invalid_output))
            )

        alias_targets = [value for value in self.column_aliases.values()]
        invalid_aliases = [alias for alias in alias_targets if alias not in allowed]
        if invalid_aliases:
            raise ValueError(
                "column_aliases가 허용되지 않은 대상 컬럼을 가리킵니다: "
                + ", ".join(sorted(invalid_aliases))
            )

        profile_names = {profile.name for profile in self.profiles}
        if self.active_profile and self.active_profile not in profile_names:
            raise ValueError(
                "active_profile이 프로파일 목록에 존재하지 않습니다: " + self.active_profile
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


@dataclass
class BlueprintToggle:
    """GUI 블루프린트 영역의 가능/불가 상태를 표현한다."""

    id: str
    label: str
    enabled: bool = True
    description: Optional[str] = None
    shade: str = "oklch(0.82 0.06 235)"
    accent: Optional[str] = "oklch(0.68 0.10 235)"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "enabled": self.enabled,
            "description": self.description,
            "shade": self.shade,
            "accent": self.accent,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BlueprintToggle":
        if not data:
            data = {}
        return cls(
            id=data.get("id", "unknown"),
            label=data.get("label", "미지정"),
            enabled=bool(data.get("enabled", True)),
            description=data.get("description"),
            shade=data.get("shade", "oklch(0.82 0.06 235)"),
            accent=data.get("accent", "oklch(0.68 0.10 235)"),
        )


@dataclass
class DataSourceConfig:
    """Access/테이블/컬럼 구성을 UI에서 조정 가능하도록 저장."""

    access_path: str = "routing_data/ROUTING AUTO TEST.accdb"
    default_table: str = "dbo_BI_ITEM_INFO_VIEW"
    backup_paths: List[str] = field(default_factory=list)
    table_profiles: List[Dict[str, Any]] = field(
        default_factory=lambda: [
            {
                "name": "dbo_BI_ITEM_INFO_VIEW",
                "label": "품목 마스터",
                "role": "features",
                "required": True,
                "columns": ["ITEM_CD", "ITEM_NM", "ITEM_TYPE", "RAW_MATL_KIND"],
            },
            {
                "name": "dbo_BI_ROUTING_VIEW",
                "label": "라우팅 기준",
                "role": "routing",
                "required": True,
                "columns": [
                    "ITEM_CD",
                    "PROC_SEQ",
                    "JOB_CD",
                    "SETUP_TIME",
                    "MACH_WORKED_HOURS",
                ],
            },
            {
                "name": "dbo_BI_WORK_ORDER_RESULTS",
                "label": "실적 로그",
                "role": "results",
                "required": False,
                "columns": [
                    "ITEM_CD",
                    "ACT_SETUP_TIME",
                    "ACT_RUN_TIME",
                    "WAIT_TIME",
                    "MOVE_TIME",
                ],
            },
        ]
    )
    column_overrides: Dict[str, List[str]] = field(default_factory=dict)
    allow_gui_override: bool = True
    shading_palette: Dict[str, str] = field(
        default_factory=lambda: {
            "allowed": "oklch(0.94 0.04 235)",
            "restricted": "oklch(0.88 0.03 235)",
            "disabled": "oklch(0.78 0.02 235)",
            "highlight": "oklch(0.70 0.08 235)",
        }
    )
    blueprint_switches: List[BlueprintToggle] = field(
        default_factory=lambda: [
            BlueprintToggle(
                id="feature-columns",
                label="피처 추출",
                enabled=True,
                description="ITEM_INFO_VIEW 기반 피처는 활성화 상태",
            ),
            BlueprintToggle(
                id="routing-columns",
                label="라우팅 기준",
                enabled=True,
                description="ROUTING_VIEW는 수정 가능",
            ),
            BlueprintToggle(
                id="workorder-columns",
                label="실적 로그",
                enabled=False,
                description="실적 로그는 기본 비활성 (GUI에서 명시적으로 활성화 필요)",
                shade="oklch(0.78 0.02 235)",
                accent="oklch(0.64 0.06 235)",
            ),
        ]
    )
    version_hint: str = "access-config-v1"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "access_path": self.access_path,
            "default_table": self.default_table,
            "backup_paths": list(self.backup_paths),
            "table_profiles": list(self.table_profiles),
            "column_overrides": {k: list(v) for k, v in self.column_overrides.items()},
            "allow_gui_override": self.allow_gui_override,
            "shading_palette": dict(self.shading_palette),
            "blueprint_switches": [toggle.to_dict() for toggle in self.blueprint_switches],
            "version_hint": self.version_hint,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DataSourceConfig":
        if not data:
            data = {}
        switches = [BlueprintToggle.from_dict(item) for item in data.get("blueprint_switches", [])]
        if not switches:
            switches = cls().blueprint_switches
        instance = cls(
            access_path=data.get("access_path", "routing_data/ROUTING AUTO TEST.accdb"),
            default_table=data.get("default_table", "dbo_BI_ITEM_INFO_VIEW"),
            backup_paths=data.get("backup_paths", []),
            table_profiles=data.get("table_profiles", cls().table_profiles),
            column_overrides={k: list(v) for k, v in data.get("column_overrides", {}).items()},
            allow_gui_override=bool(data.get("allow_gui_override", True)),
            shading_palette=data.get("shading_palette", cls().shading_palette),
            blueprint_switches=switches,
            version_hint=data.get("version_hint", "access-config-v1"),
        )
        return instance


@dataclass
class ExportFormatConfig:
    """예측 결과 내보내기 옵션."""

    enable_cache_save: bool = False
    enable_excel: bool = True
    enable_csv: bool = True
    enable_txt: bool = True
    enable_parquet: bool = True
    enable_json: bool = True
    erp_interface_enabled: bool = False
    erp_protocol: Optional[str] = None
    erp_endpoint: Optional[str] = None
    default_encoding: str = "utf-8"
    export_directory: str = "deliverables/exports"
    compress_on_save: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "enable_cache_save": self.enable_cache_save,
            "enable_excel": self.enable_excel,
            "enable_csv": self.enable_csv,
            "enable_txt": self.enable_txt,
            "enable_parquet": self.enable_parquet,
            "enable_json": self.enable_json,
            "erp_interface_enabled": self.erp_interface_enabled,
            "erp_protocol": self.erp_protocol,
            "erp_endpoint": self.erp_endpoint,
            "default_encoding": self.default_encoding,
            "export_directory": self.export_directory,
            "compress_on_save": self.compress_on_save,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExportFormatConfig":
        if not data:
            data = {}
        return cls(
            enable_cache_save=bool(data.get("enable_cache_save", False)),
            enable_excel=bool(data.get("enable_excel", True)),
            enable_csv=bool(data.get("enable_csv", True)),
            enable_txt=bool(data.get("enable_txt", True)),
            enable_parquet=bool(data.get("enable_parquet", True)),
            enable_json=bool(data.get("enable_json", True)),
            erp_interface_enabled=bool(data.get("erp_interface_enabled", False)),
            erp_protocol=data.get("erp_protocol"),
            erp_endpoint=data.get("erp_endpoint"),
            default_encoding=data.get("default_encoding", "utf-8"),
            export_directory=data.get("export_directory", "deliverables/exports"),
            compress_on_save=bool(data.get("compress_on_save", True)),
        )


@dataclass
class VisualizationConfig:
    """TensorBoard/Neo4j 시각화 설정."""

    tensorboard_projector_dir: str = "logs/tensorboard"
    projector_enabled: bool = True
    projector_metadata_columns: List[str] = field(
        default_factory=lambda: ["ITEM_CD", "ITEM_NM", "GROUP1", "ITEM_TYPE"]
    )
    neo4j_enabled: bool = True
    neo4j_browser_url: str = "http://localhost:7474"
    neo4j_workspace: str = "neo4j+routing"
    publish_service_enabled: bool = True
    publish_notes: Optional[str] = "TensorBoard Projector와 Neo4j 모두 동일한 임베딩을 사용합니다."

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tensorboard_projector_dir": self.tensorboard_projector_dir,
            "projector_enabled": self.projector_enabled,
            "projector_metadata_columns": list(self.projector_metadata_columns),
            "neo4j_enabled": self.neo4j_enabled,
            "neo4j_browser_url": self.neo4j_browser_url,
            "neo4j_workspace": self.neo4j_workspace,
            "publish_service_enabled": self.publish_service_enabled,
            "publish_notes": self.publish_notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VisualizationConfig":
        if not data:
            data = {}
        return cls(
            tensorboard_projector_dir=data.get("tensorboard_projector_dir", "logs/tensorboard"),
            projector_enabled=bool(data.get("projector_enabled", True)),
            projector_metadata_columns=data.get(
                "projector_metadata_columns", ["ITEM_CD", "ITEM_NM", "GROUP1", "ITEM_TYPE"]
            ),
            neo4j_enabled=bool(data.get("neo4j_enabled", True)),
            neo4j_browser_url=data.get("neo4j_browser_url", "http://localhost:7474"),
            neo4j_workspace=data.get("neo4j_workspace", "neo4j+routing"),
            publish_service_enabled=bool(data.get("publish_service_enabled", True)),
            publish_notes=data.get(
                "publish_notes",
                "TensorBoard Projector와 Neo4j 모두 동일한 임베딩을 사용합니다.",
            ),
        )


DEFAULT_CONFIG: Dict[str, Any] = {
    "graph": WorkflowGraphConfig().to_dict(),
    "trainer": TrainerRuntimeConfig().to_dict(),
    "predictor": PredictorRuntimeConfig().to_dict(),
    "sql": SQLColumnConfig().to_dict(),
    "data_source": DataSourceConfig().to_dict(),
    "export": ExportFormatConfig().to_dict(),
    "visualization": VisualizationConfig().to_dict(),
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

    def get_data_source_config(self) -> DataSourceConfig:
        data = self.load().get("data_source", {})
        return DataSourceConfig.from_dict(data)

    def update_data_source_config(self, config: DataSourceConfig) -> Dict[str, Any]:
        return self.update_config({"data_source": config.to_dict()})

    def get_export_config(self) -> ExportFormatConfig:
        data = self.load().get("export", {})
        return ExportFormatConfig.from_dict(data)

    def update_export_config(self, config: ExportFormatConfig) -> Dict[str, Any]:
        return self.update_config({"export": config.to_dict()})

    def get_visualization_config(self) -> VisualizationConfig:
        data = self.load().get("visualization", {})
        return VisualizationConfig.from_dict(data)

    def update_visualization_config(self, config: VisualizationConfig) -> Dict[str, Any]:
        return self.update_config({"visualization": config.to_dict()})

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
    "DataSourceConfig",
    "ExportFormatConfig",
    "VisualizationConfig",
    "BlueprintToggle",
]
