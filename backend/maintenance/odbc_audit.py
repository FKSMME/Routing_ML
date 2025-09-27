"""Utility to audit installed ODBC drivers against the policy matrix."""
from __future__ import annotations

import json
import platform
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

POLICY_PATH = Path("config/odbc_driver_policy.json")
OUTPUT_DIR = Path("logs/audit")


@dataclass
class DriverInfo:
    name: str
    version: Optional[str]
    architecture: Optional[str]

    def to_dict(self) -> Dict[str, Optional[str]]:
        return {
            "name": self.name,
            "version": self.version,
            "architecture": self.architecture,
        }


def load_policy() -> Dict[str, Dict[str, object]]:
    if not POLICY_PATH.exists():
        raise FileNotFoundError(f"ODBC driver policy file not found: {POLICY_PATH}")
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def discover_drivers() -> List[DriverInfo]:
    """Attempt to enumerate installed ODBC drivers using best effort methods."""

    drivers: List[DriverInfo] = []

    try:
        import pyodbc  # type: ignore

        for entry in pyodbc.drivers():  # pragma: no cover - depends on environment
            drivers.append(DriverInfo(name=entry, version=None, architecture=None))
    except Exception:
        pass

    system = platform.system().lower()
    if system in {"linux", "darwin"}:
        try:
            result = subprocess.run(
                ["odbcinst", "-q", "-d"],
                check=False,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            result = None
        if result and result.stdout:
            for line in result.stdout.splitlines():
                name = line.strip().strip("[]")
                if name:
                    drivers.append(DriverInfo(name=name, version=None, architecture=None))
    elif system == "windows":  # pragma: no cover - CI runs on linux
        powershell = [
            "powershell",
            "-NoProfile",
            "-Command",
            "Get-OdbcDriver | Select-Object Name,DriverMajorVersion,DriverMinorVersion,Platform | ConvertTo-Json",
        ]
        result = subprocess.run(powershell, check=False, capture_output=True, text=True)
        if result.stdout:
            try:
                entries = json.loads(result.stdout)
                if isinstance(entries, dict):
                    entries = [entries]
                for entry in entries or []:
                    version = None
                    if entry.get("DriverMajorVersion") is not None:
                        version = f"{entry['DriverMajorVersion']}.{entry.get('DriverMinorVersion', 0)}"
                    drivers.append(
                        DriverInfo(
                            name=entry.get("Name", "unknown"),
                            version=version,
                            architecture=entry.get("Platform"),
                        )
                    )
            except json.JSONDecodeError:
                pass

    unique = {(driver.name, driver.version, driver.architecture): driver for driver in drivers}
    return list(unique.values())


def evaluate_policy(drivers: List[DriverInfo], policy: Dict[str, Dict[str, object]]) -> Dict[str, object]:
    discovered = {driver.name: driver for driver in drivers}
    results: Dict[str, object] = {"compliant": True, "checks": []}

    for driver_name, rules in policy.items():
        info = discovered.get(driver_name)
        status = "missing"
        details: Dict[str, object] = {"driver": driver_name}

        if info:
            status = "present"
            details.update(info.to_dict())
            expected_arch = rules.get("architecture")
            if expected_arch and info.architecture and info.architecture not in expected_arch:
                status = "architecture-mismatch"
                results["compliant"] = False
                details["expected_architecture"] = expected_arch

            min_version = rules.get("min_version")
            if min_version and info.version:
                if tuple(int(part) for part in info.version.split(".")) < tuple(
                    int(part) for part in str(min_version).split(".")
                ):
                    status = "version-too-low"
                    results["compliant"] = False
                    details["expected_min_version"] = min_version
        else:
            results["compliant"] = False

        details["status"] = status
        results["checks"].append(details)

    extra_drivers = [name for name in discovered.keys() if name not in policy]
    if extra_drivers:
        results["extra_drivers"] = extra_drivers

    return results


def main() -> Path:
    policy = load_policy()
    drivers = discover_drivers()
    evaluation = evaluate_policy(drivers, policy)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = OUTPUT_DIR / f"odbc_driver_audit-{timestamp}.json"
    report = {
        "generated_at": timestamp,
        "policy_path": str(POLICY_PATH),
        "driver_count": len(drivers),
        "evaluation": evaluation,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(report_path)
    return report_path


if __name__ == "__main__":
    main()
