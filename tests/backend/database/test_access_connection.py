import pandas as pd
import pytest

from backend import database
from backend.api.services.master_data_service import MasterDataService


@pytest.fixture()
def master_data_service() -> MasterDataService:
    return MasterDataService(cache_ttl_seconds=0)


def test_get_database_metadata_uses_describe_table(monkeypatch: pytest.MonkeyPatch, master_data_service: MasterDataService) -> None:
    expected_columns = [
        {"name": "ITEM_CD", "type": "nvarchar", "nullable": False},
        {"name": "ITEM_NM", "type": "nvarchar", "nullable": True},
    ]

    monkeypatch.setattr(database, "describe_table", lambda table: expected_columns)

    result = master_data_service.get_database_metadata(table="dbo.ITEMS")

    assert result["table"] == "dbo.ITEMS"
    assert result["columns"] == expected_columns


def test_get_database_metadata_falls_back_to_dataframe(monkeypatch: pytest.MonkeyPatch, master_data_service: MasterDataService) -> None:
    def raise_error(table: str) -> list[dict[str, object]]:
        raise ValueError(f"missing table: {table}")

    monkeypatch.setattr(database, "describe_table", raise_error)
    monkeypatch.setattr(
        database,
        "fetch_item_master",
        lambda columns=None: pd.DataFrame({"ITEM_CD": ["A"], "ITEM_NM": ["Widget"]}),
    )

    result = master_data_service.get_database_metadata(table="dbo.ITEMS")

    column_names = [column["name"] for column in result["columns"]]
    assert "ITEM_CD" in column_names
    assert result["server"] == database.MSSQL_CONFIG["server"]


def test_detect_connection_status_handles_failure(monkeypatch: pytest.MonkeyPatch, master_data_service: MasterDataService) -> None:
    monkeypatch.setattr(database, "get_database_info", lambda: (_ for _ in ()).throw(RuntimeError("boom")))

    status = master_data_service._detect_connection_status()

    assert status["status"] == "disconnected"
