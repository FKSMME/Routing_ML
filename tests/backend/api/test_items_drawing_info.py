from __future__ import annotations

from datetime import timedelta

import pandas as pd
import pytest

from backend.api.routes import items as items_route
from backend.api.schemas import AuthenticatedUser
from common.datetime_utils import utc_now_naive


@pytest.fixture()
def authenticated_user() -> AuthenticatedUser:
    now = utc_now_naive()
    return AuthenticatedUser(
        username="tester",
        display_name="Test User",
        status="approved",
        is_admin=True,
        issued_at=now,
        expires_at=now + timedelta(hours=1),
    )


@pytest.mark.asyncio()
async def test_drawing_info_returns_payload_when_drawing_exists(
    authenticated_user: AuthenticatedUser, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Endpoint should surface drawing metadata when the record exists."""

    def fake_fetch_single_item(item_cd: str) -> pd.DataFrame:  # type: ignore[override]
        assert item_cd == "ITEM-123"
        return pd.DataFrame(
            [
                {
                    "DRAW_NO": "DWG-100",
                    "DRAW_REV": "B",
                    "DRAW_SHEET_NO": "2",
                }
            ]
        )

    monkeypatch.setattr(items_route, "fetch_single_item", fake_fetch_single_item)

    payload = await items_route.get_drawing_info("ITEM-123", current_user=authenticated_user)

    assert payload == {
        "drawingNumber": "DWG-100",
        "revision": "B",
        "sheetNumber": "2",
        "available": True,
    }


@pytest.mark.asyncio()
async def test_drawing_info_handles_missing_item(
    authenticated_user: AuthenticatedUser, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Endpoint should return unavailable payload when the item is missing."""

    def fake_fetch_single_item(item_cd: str) -> pd.DataFrame:  # type: ignore[override]
        return pd.DataFrame()

    monkeypatch.setattr(items_route, "fetch_single_item", fake_fetch_single_item)

    payload = await items_route.get_drawing_info("NON-EXISTENT", current_user=authenticated_user)

    assert payload == {
        "drawingNumber": "",
        "revision": "",
        "sheetNumber": "",
        "available": False,
    }


@pytest.mark.asyncio()
async def test_drawing_info_gracefully_handles_errors(
    authenticated_user: AuthenticatedUser, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unexpected errors should fall back to the empty response contract."""

    def fake_fetch_single_item(item_cd: str) -> pd.DataFrame:  # type: ignore[override]
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(items_route, "fetch_single_item", fake_fetch_single_item)

    payload = await items_route.get_drawing_info("ITEM-ERROR", current_user=authenticated_user)

    assert payload == {
        "drawingNumber": "",
        "revision": "",
        "sheetNumber": "",
        "available": False,
    }
