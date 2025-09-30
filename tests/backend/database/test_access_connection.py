import pathlib

import pytest

from backend.api.services.master_data_service import MasterDataService


@pytest.fixture()
def master_data_service() -> MasterDataService:
    return MasterDataService(cache_ttl_seconds=0)


def test_validate_access_path_accepts_existing_accdb(tmp_path: pathlib.Path, master_data_service: MasterDataService) -> None:
    db_file = tmp_path / "sample.accdb"
    db_file.write_text("", encoding="utf-8")

    resolved = master_data_service.validate_access_path(db_file)

    assert resolved == db_file


def test_validate_access_path_rejects_missing_file(master_data_service: MasterDataService) -> None:
    with pytest.raises(FileNotFoundError):
        master_data_service.validate_access_path("/tmp/nonexistent.accdb")


def test_validate_access_path_requires_access_extension(tmp_path: pathlib.Path, master_data_service: MasterDataService) -> None:
    db_file = tmp_path / "not_access.sqlite"
    db_file.write_text("", encoding="utf-8")

    with pytest.raises(ValueError):
        master_data_service.validate_access_path(db_file)


def test_read_access_tables_returns_sorted_unique_names(
    tmp_path: pathlib.Path, master_data_service: MasterDataService, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_file = tmp_path / "routing.accdb"
    db_file.write_text("", encoding="utf-8")

    def fake_list_tables(path: pathlib.Path) -> list[str]:
        assert path == db_file
        return ["Routing", "Items", "Items", "Vendors"]

    monkeypatch.setattr(master_data_service, "_list_access_tables", fake_list_tables)

    tables = master_data_service.read_access_tables(db_file)

    assert tables == ["Items", "Routing", "Vendors"]


def test_read_access_tables_raises_when_no_tables(
    tmp_path: pathlib.Path, master_data_service: MasterDataService, monkeypatch: pytest.MonkeyPatch
) -> None:
    db_file = tmp_path / "routing.accdb"
    db_file.write_text("", encoding="utf-8")

    monkeypatch.setattr(master_data_service, "_list_access_tables", lambda _: [])

    with pytest.raises(RuntimeError) as exc_info:
        master_data_service.read_access_tables(db_file)

    assert "테이블 목록" in str(exc_info.value)
