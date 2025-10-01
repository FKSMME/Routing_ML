import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.api.services.training_service import TrainingService
from common.training_state import TrainingStatusPayload, save_status


def test_get_status_handles_artifact_permission_error(monkeypatch, tmp_path):
    class DummySettings:
        def __init__(self, root: Path) -> None:
            self.model_directory = root / "models"
            self.model_directory.mkdir(parents=True, exist_ok=True)
            self.model_registry_path = root / "registry.db"

    monkeypatch.setattr(
        "backend.api.services.training_service.get_settings",
        lambda: DummySettings(tmp_path),
    )
    monkeypatch.setattr(
        "backend.api.services.training_service.list_versions",
        lambda *args, **kwargs: [],
    )

    version_dir = tmp_path / "artifacts"
    version_dir.mkdir()
    metrics_path = version_dir / "training_metrics.json"
    metrics_path.write_text("{\"ok\": true}", encoding="utf-8")

    status_path = tmp_path / "status.json"
    save_status(
        TrainingStatusPayload(status="running", version_path=str(version_dir)),
        path=status_path,
    )

    original_read_text = Path.read_text

    def fake_read_text(self, *args, **kwargs):  # type: ignore[override]
        if self == metrics_path:
            raise PermissionError("denied")
        return original_read_text(self, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", fake_read_text)

    service = TrainingService(status_path=status_path)

    result = service.get_status()

    warnings = result.get("metrics", {}).get("warnings", [])
    assert any("training_metrics.json" in warning for warning in warnings)
    assert "training_metrics" not in result.get("metrics", {})
