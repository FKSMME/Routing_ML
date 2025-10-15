from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List

import pandas as pd
import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi.testclient import TestClient

from backend.api.app import create_app
from backend.api.routes.master_data import require_auth
from backend.api.schemas import AuthenticatedUser
from backend.api.services.master_data_service import MasterDataService
from common.datetime_utils import utc_now_naive


@pytest.fixture()
def master_data_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    records: List[Dict[str, object]] = [
        {
            "ITEM_CD": "A-100",
            "ITEM_NM": "Widget Assembly",
            "ITEM_SPEC": "WA-1",
            "ADDITIONAL_SPEC": "Blue",
            "ITEM_MATERIAL": "Steel",
            "ITEM_GRP1": "GRP-A",
            "ITEM_GRP1NM": "Machinery",
            "ITEM_GRP2": "ASM",
            "ITEM_GRP2NM": "Assembly",
            "GROUP1": "Machinery",
            "GROUP2": "Assembly",
            "GROUP3": "Line-1",
            "INSRT_DT": datetime(2023, 1, 1),
            "MODI_DT": datetime(2023, 1, 5),
        },
        {
            "ITEM_CD": "A-200",
            "ITEM_NM": "Widget Finish",
            "ITEM_SPEC": "WF-2",
            "ADDITIONAL_SPEC": "Polished",
            "ITEM_MATERIAL": "Steel",
            "ITEM_GRP1": "GRP-A",
            "ITEM_GRP1NM": "Machinery",
            "ITEM_GRP2": "FIN",
            "ITEM_GRP2NM": "Finishing",
            "GROUP1": "Machinery",
            "GROUP2": "Finishing",
            "GROUP3": "Line-2",
            "INSRT_DT": datetime(2023, 2, 1),
            "MODI_DT": datetime(2023, 2, 5),
        },
        {
            "ITEM_CD": "B-100",
            "ITEM_NM": "Control Board",
            "ITEM_SPEC": "CB-9",
            "ADDITIONAL_SPEC": "",
            "ITEM_MATERIAL": "Copper",
            "ITEM_GRP1": "GRP-B",
            "ITEM_GRP1NM": "Electronics",
            "ITEM_GRP2": "PCB",
            "ITEM_GRP2NM": "Boards",
            "GROUP1": "Electronics",
            "GROUP2": "Boards",
            "GROUP3": "Line-3",
            "INSRT_DT": datetime(2023, 3, 1),
            "MODI_DT": datetime(2023, 3, 5),
        },
    ]
    frame = pd.DataFrame.from_records(records)

    def fake_fetch_item_master(*, columns=None, use_cache=True):  # type: ignore[override]
        if columns is None:
            return frame.copy()
        existing_cols = [col for col in columns if col in frame.columns]
        subset = frame[existing_cols].copy()
        for missing in columns:
            if missing not in subset.columns:
                subset[missing] = ""
        return subset

    monkeypatch.setattr("backend.database.fetch_item_master", fake_fetch_item_master)

    service = MasterDataService(cache_ttl_seconds=0)

    monkeypatch.setattr("backend.api.services.master_data_service.master_data_service", service)
    monkeypatch.setattr("backend.api.routes.master_data.master_data_service", service)

    app = create_app()

    def fake_user() -> AuthenticatedUser:
        now = utc_now_naive()
        return AuthenticatedUser(
            username="tester",
            display_name="Test User",
            status="approved",
            is_admin=True,
            issued_at=now,
            expires_at=now + timedelta(hours=1),
        )

    app.dependency_overrides[require_auth] = fake_user

    client = TestClient(app)
    try:
        yield client
    finally:
        client.close()


def test_master_data_tree_hierarchy(master_data_client: TestClient) -> None:
    client = master_data_client

    root_response = client.get("/api/master-data/tree")
    assert root_response.status_code == 200
    root_payload = root_response.json()

    assert root_payload["total_items"] == 3
    groups = root_payload["nodes"]
    assert {node["type"] for node in groups} == {"group"}

    machinery_group = next(node for node in groups if node["meta"]["group_label"] == "Machinery")
    assert machinery_group["meta"]["item_count"] == "2"

    group_id = machinery_group["id"]
    families_response = client.get(
        "/api/master-data/tree",
        params={"parent_type": "group", "parent_id": group_id},
    )
    assert families_response.status_code == 200
    families = families_response.json()["nodes"]
    assert {node["type"] for node in families} == {"family"}

    assembly_family = next(node for node in families if node["label"] == "Assembly")
    assert assembly_family["meta"]["item_count"] == "1"
    family_id = assembly_family["id"]
    assert assembly_family["meta"]["group_id"] == group_id

    items_response = client.get(
        "/api/master-data/tree",
        params={"parent_type": "family", "parent_id": family_id},
    )
    assert items_response.status_code == 200
    items = items_response.json()["nodes"]
    assert len(items) == 1
    item_node = items[0]
    assert item_node["type"] == "item"
    assert item_node["id"] == "A-100"
    assert item_node["meta"]["group_id"] == group_id
    assert item_node["meta"]["family_id"] == family_id
    assert item_node["meta"]["item_code"] == "A-100"

    electronics_group = next(node for node in groups if node["meta"]["group_label"] == "Electronics")
    assert electronics_group["meta"]["item_count"] == "1"
