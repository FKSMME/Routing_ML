#!/usr/bin/env python3
"""Validate compatibility between model manifests and SQL profile schemas."""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

# Default compatibility mapping used when manifests do not explicitly declare
# the SQL profile schema versions they depend on.
DEFAULT_MANIFEST_SQL_SCHEMAS: Dict[str, List[str]] = {
    "routing-ml/manifest@1": ["routing-ml/sql-profile@1"],
}

REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_ROOT = REPO_ROOT / "models"
SQL_PROFILE_ROOT = REPO_ROOT / "config" / "sql_profiles"
REPORT_PATH = REPO_ROOT / "logs" / "quality" / "sql_schema_compatibility_report.json"
SCHEMA_REGISTRY_FILENAME = "schema_version.json"


@dataclass
class RegistryInfo:
    schema_version: Optional[str] = None
    supported_manifest_versions: List[str] = None  # type: ignore[assignment]
    errors: List[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:  # pragma: no cover - dataclass helper
        if self.supported_manifest_versions is None:
            self.supported_manifest_versions = []
        if self.errors is None:
            self.errors = []


def _relative(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:  # pragma: no cover - defensive
        return str(path)


def _load_json(path: Path, errors: List[str]) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{_relative(path)}: invalid JSON ({exc})")
    except FileNotFoundError:
        errors.append(f"{_relative(path)}: file not found")
    return None


def _normalise_string_list(value: Any, errors: List[str], context: str) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        errors.append(f"{context}: expected a list of strings")
        return []
    result: List[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            errors.append(f"{context}: invalid entry {item!r}; expected non-empty string")
            continue
        result.append(item.strip())
    # Preserve order but remove duplicates while keeping first occurrence.
    seen = set()
    ordered: List[str] = []
    for item in result:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def load_registry() -> RegistryInfo:
    registry_path = SQL_PROFILE_ROOT / SCHEMA_REGISTRY_FILENAME
    registry = RegistryInfo()
    if not registry_path.exists():
        return registry
    data = _load_json(registry_path, registry.errors)
    if data is None:
        return registry
    current = data.get("current")
    if current is not None:
        if not isinstance(current, str) or not current.strip():
            registry.errors.append(
                f"{_relative(registry_path)}: 'current' must be a non-empty string"
            )
        else:
            registry.schema_version = current.strip()
    supported = data.get("supported_manifest_versions")
    registry.supported_manifest_versions = _normalise_string_list(
        supported,
        registry.errors,
        f"{_relative(registry_path)}: supported_manifest_versions",
    )
    return registry


def gather_manifests(errors: List[str]) -> List[Dict[str, Any]]:
    manifests: List[Dict[str, Any]] = []
    manifest_paths = sorted(MANIFEST_ROOT.rglob("manifest.json"))
    for manifest_path in manifest_paths:
        manifest_errors: List[str] = []
        payload = _load_json(manifest_path, manifest_errors)
        entry: Dict[str, Any] = {
            "path": _relative(manifest_path),
            "schema_version": None,
            "sql_profile_schema_versions": [],
            "sql_profile_schema_versions_source": None,
            "generated_at": None,
            "status": "ok",
            "errors": manifest_errors,
            "compatible_profiles": [],
            "missing_sql_profile_schemas": [],
        }
        if payload is None:
            entry["status"] = "error"
            errors.extend(manifest_errors)
            manifests.append(entry)
            continue
        schema_version = payload.get("schema_version")
        if not isinstance(schema_version, str) or not schema_version.strip():
            manifest_errors.append("schema_version is missing or empty")
        else:
            entry["schema_version"] = schema_version.strip()
        entry["generated_at"] = payload.get("generated_at")

        metadata = payload.get("metadata") if isinstance(payload, dict) else None
        sql_versions_raw = None
        if isinstance(metadata, dict):
            sql_versions_raw = metadata.get("sql_profile_schema_versions")
        sql_versions = _normalise_string_list(
            sql_versions_raw,
            manifest_errors,
            f"{entry['path']}: metadata.sql_profile_schema_versions",
        )
        source = "metadata"
        if not sql_versions:
            # Fall back to predefined defaults when metadata is absent.
            source = "default"
            default_versions = []
            if entry["schema_version"]:
                default_versions = DEFAULT_MANIFEST_SQL_SCHEMAS.get(entry["schema_version"], [])
            sql_versions = list(default_versions)
        entry["sql_profile_schema_versions"] = sql_versions
        entry["sql_profile_schema_versions_source"] = source
        if manifest_errors:
            entry["status"] = "error"
            errors.extend(manifest_errors)
        manifests.append(entry)
    return manifests


def gather_profiles(errors: List[str]) -> List[Dict[str, Any]]:
    profiles: List[Dict[str, Any]] = []
    profile_paths = sorted(SQL_PROFILE_ROOT.glob("*.json"))
    for profile_path in profile_paths:
        if profile_path.name == SCHEMA_REGISTRY_FILENAME:
            continue
        profile_errors: List[str] = []
        payload = _load_json(profile_path, profile_errors)
        entry: Dict[str, Any] = {
            "path": _relative(profile_path),
            "schema_version": None,
            "compatible_manifest_versions": [],
            "name": None,
            "status": "ok",
            "errors": profile_errors,
        }
        if payload is None:
            entry["status"] = "error"
            errors.extend(profile_errors)
            profiles.append(entry)
            continue
        schema_version = payload.get("schema_version")
        if not isinstance(schema_version, str) or not schema_version.strip():
            profile_errors.append("schema_version is missing or empty")
        else:
            entry["schema_version"] = schema_version.strip()
        manifest_versions = _normalise_string_list(
            payload.get("compatible_manifest_versions"),
            profile_errors,
            f"{entry['path']}: compatible_manifest_versions",
        )
        entry["compatible_manifest_versions"] = manifest_versions
        name = payload.get("name")
        if isinstance(name, str) and name.strip():
            entry["name"] = name.strip()
        if profile_errors:
            entry["status"] = "error"
            errors.extend(profile_errors)
        profiles.append(entry)
    return profiles


def build_report() -> Dict[str, Any]:
    violations: List[str] = []
    registry = load_registry()
    violations.extend(registry.errors)

    manifests = gather_manifests(violations)
    profiles = gather_profiles(violations)

    schema_version_to_profiles: Dict[str, List[Dict[str, Any]]] = {}
    manifest_version_to_profiles: Dict[str, List[Dict[str, Any]]] = {}
    for profile in profiles:
        schema_version = profile.get("schema_version")
        if schema_version:
            schema_version_to_profiles.setdefault(schema_version, []).append(profile)
        for manifest_version in profile.get("compatible_manifest_versions", []):
            manifest_version_to_profiles.setdefault(manifest_version, []).append(profile)

    # Validate profile entries against registry expectations.
    for profile in profiles:
        profile_errors = profile["errors"]
        schema_version = profile.get("schema_version")
        compatible_manifests = profile.get("compatible_manifest_versions", [])
        if registry.schema_version and schema_version and schema_version != registry.schema_version:
            message = (
                f"{profile['path']}: schema_version '{schema_version}' does not match registry"
                f" expectation '{registry.schema_version}'"
            )
            profile_errors.append(message)
            violations.append(message)
        if registry.supported_manifest_versions and compatible_manifests:
            unsupported = [
                version
                for version in compatible_manifests
                if version not in registry.supported_manifest_versions
            ]
            if unsupported:
                message = (
                    f"{profile['path']}: declares unsupported manifest versions: "
                    + ", ".join(sorted(unsupported))
                )
                profile_errors.append(message)
                violations.append(message)
        if not compatible_manifests:
            message = f"{profile['path']}: no compatible_manifest_versions declared"
            profile_errors.append(message)
            violations.append(message)
        if profile_errors:
            profile["status"] = "error"

    # Validate manifest entries and link compatible profiles.
    for manifest in manifests:
        manifest_errors = manifest["errors"]
        manifest_version = manifest.get("schema_version")
        sql_profile_versions = manifest.get("sql_profile_schema_versions", [])
        if registry.supported_manifest_versions and manifest_version:
            if manifest_version not in registry.supported_manifest_versions:
                message = (
                    f"{manifest['path']}: manifest schema '{manifest_version}' is not"
                    f" listed in {SCHEMA_REGISTRY_FILENAME}"
                )
                manifest_errors.append(message)
                violations.append(message)
        if manifest_version:
            compatible_profiles = manifest_version_to_profiles.get(manifest_version, [])
            manifest["compatible_profiles"] = [
                {
                    "name": profile.get("name"),
                    "schema_version": profile.get("schema_version"),
                    "path": profile.get("path"),
                }
                for profile in sorted(
                    compatible_profiles,
                    key=lambda item: (
                        item.get("name") or "",
                        item.get("path") or "",
                    ),
                )
            ]
            if not compatible_profiles:
                message = (
                    f"{manifest['path']}: no SQL profiles declare compatibility with manifest"
                    f" schema '{manifest_version}'"
                )
                manifest_errors.append(message)
                violations.append(message)
        missing_sql_versions = [
            version
            for version in sql_profile_versions
            if version not in schema_version_to_profiles
        ]
        if missing_sql_versions:
            message = (
                f"{manifest['path']}: missing SQL profiles for schema versions: "
                + ", ".join(sorted(missing_sql_versions))
            )
            manifest_errors.append(message)
            violations.append(message)
        manifest["missing_sql_profile_schemas"] = sorted(missing_sql_versions)
        if manifest_errors:
            manifest["status"] = "error"

    summary = {
        "manifests_checked": len(manifests),
        "profiles_checked": len(profiles),
        "violations": len(violations),
    }

    report = {
        "summary": summary,
        "registry": {
            "path": _relative(SQL_PROFILE_ROOT / SCHEMA_REGISTRY_FILENAME),
            "schema_version": registry.schema_version,
            "supported_manifest_versions": sorted(registry.supported_manifest_versions),
            "status": "error" if registry.errors else "ok",
            "errors": registry.errors,
        },
        "manifests": manifests,
        "profiles": profiles,
        "violations": violations,
    }
    return report


def write_report(report: Dict[str, Any]) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if REPORT_PATH.exists():
        current = REPORT_PATH.read_text(encoding="utf-8")
        if current == payload:
            return
    REPORT_PATH.write_text(payload, encoding="utf-8")


def main() -> int:
    report = build_report()
    write_report(report)
    violations = report.get("violations", [])
    if violations:
        sys.stderr.write(
            "SQL schema compatibility check failed:\n - "
            + "\n - ".join(violations)
            + "\n"
        )
        return 1
    sys.stdout.write(
        "SQL schema compatibility check passed. Report saved to "
        f"{_relative(REPORT_PATH)}\n"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
