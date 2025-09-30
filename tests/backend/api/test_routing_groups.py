import csv
import io
from typing import Dict, Tuple

import pytest

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

from fastapi.testclient import TestClient

pytest_plugins = ["tests.test_rsl_routing_groups"]


@pytest.fixture()
def seeded_rsl_group(api_client: Tuple[TestClient, Dict[str, str]]) -> Dict[str, str]:
    client, headers = api_client

    group_payload = {
        "name": "ERP Export QA",
        "description": "자동화된 다중 포맷 내보내기 테스트",
        "tags": ["qa", "erp"],
        "erp_required": True,
    }
    group_resp = client.post("/api/rsl/groups", headers=headers, json=group_payload)
    assert group_resp.status_code == 201, group_resp.text
    group_body = group_resp.json()

    step_payload = {
        "sequence": 1,
        "name": "Cutting",
        "description": "CNC 가공",
        "status": "draft",
        "tags": ["cnc"],
        "config": {"machine": "MX-200"},
    }
    step_resp = client.post(
        f"/api/rsl/groups/{group_body['id']}/steps",
        headers=headers,
        json=step_payload,
    )
    assert step_resp.status_code == 201, step_resp.text
    step_body = step_resp.json()

    rule_payload = {
        "rule_name": "SpeedLimit",
        "rule_version": "2024.09",
        "metadata": {"max_rpm": 1200},
        "is_optional": False,
    }
    rule_resp = client.post(
        f"/api/rsl/groups/{group_body['id']}/steps/{step_body['id']}/rules",
        headers=headers,
        json=rule_payload,
    )
    assert rule_resp.status_code == 201, rule_resp.text

    return {"id": str(group_body["id"]), "slug": group_body["slug"], "name": group_payload["name"]}


def test_export_groups_json_includes_rules(
    api_client: Tuple[TestClient, Dict[str, str]], seeded_rsl_group: Dict[str, str]
) -> None:
    client, headers = api_client

    response = client.get(
        "/api/rsl/groups/export",
        headers=headers,
        params={"format": "json", "include_archived": False},
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/json")
    exported_groups = response.json()
    assert isinstance(exported_groups, list)

    target = next(item for item in exported_groups if item["slug"] == seeded_rsl_group["slug"])
    assert target["name"] == seeded_rsl_group["name"]
    assert target["erp_required"] is True
    assert target["steps"], "Steps should be exported"
    first_step = target["steps"][0]
    assert first_step["name"] == "Cutting"
    assert first_step["rules"], "Rules should be exported"
    rule = first_step["rules"][0]
    assert rule["rule_name"] == "SpeedLimit"
    assert rule["rule_version"] == "2024.09"


def test_export_groups_csv_includes_rows(
    api_client: Tuple[TestClient, Dict[str, str]], seeded_rsl_group: Dict[str, str]
) -> None:
    client, headers = api_client

    response = client.get(
        "/api/rsl/groups/export",
        headers=headers,
        params={"format": "csv"},
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")

    reader = csv.DictReader(io.StringIO(response.text))
    rows = list(reader)
    assert rows, "CSV export should include at least one row"

    matching_rows = [row for row in rows if row["group_slug"] == seeded_rsl_group["slug"]]
    assert matching_rows, "Expected group slug not found in CSV export"

    first = matching_rows[0]
    assert first["group_name"] == seeded_rsl_group["name"]
    assert first["step_name"] == "Cutting"
    assert first["rule_name"] in {"", "SpeedLimit"}
    if first["rule_name"]:
        assert first["rule_version"] == "2024.09"
