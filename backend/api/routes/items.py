"""품목 정보 조회 API."""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from backend.database import (
    fetch_purchase_order_items,
    fetch_item_with_purchase_info,
    fetch_single_item,
)
from common.logger import get_logger

router = APIRouter(prefix="/api/items", tags=["items"])
logger = get_logger("api.items")


@router.get("/purchase-orders")
async def get_purchase_order_items(
    current_user: AuthenticatedUser = Depends(require_auth),
    limit: int = Query(100, ge=1, le=1000),
) -> List[Dict[str, Any]]:
    """
    발주 품목 목록 조회 (BI_PUR_PO_VIEW)

    Args:
        limit: 조회할 최대 레코드 수 (기본 100)

    Returns:
        발주 품목 목록
    """
    logger.info(f"발주 품목 목록 조회 요청: user={current_user.username}, limit={limit}")

    try:
        df = fetch_purchase_order_items()

        if df.empty:
            logger.warning("발주 품목 데이터 없음")
            return []

        # 최대 limit 개수만 반환
        df = df.head(limit)

        # DataFrame을 딕셔너리 리스트로 변환
        result = df.to_dict('records')

        logger.info(f"발주 품목 {len(result)}개 반환")
        return result

    except Exception as e:
        logger.warning(f"발주 품목 조회 실패 (빈 목록 반환): {e}")
        # 에러 발생 시 빈 목록 반환 (UI에서 에러 표시하지 않음)
        return []


@router.get("/{item_cd}")
async def get_item_info(
    item_cd: str,
    current_user: AuthenticatedUser = Depends(require_auth),
    include_purchase_info: bool = Query(False, description="발주 정보 포함 여부"),
) -> Dict[str, Any]:
    """
    품목 정보 조회 (BI_ITEM_INFO_VIEW)

    Args:
        item_cd: 품목 코드
        include_purchase_info: 발주 정보 포함 여부 (기본 False)

    Returns:
        품목 정보
    """
    logger.info(f"품목 정보 조회: item_cd={item_cd}, user={current_user.username}")

    try:
        if include_purchase_info:
            df = fetch_item_with_purchase_info(item_cd)
        else:
            df = fetch_single_item(item_cd)

        if df.empty:
            logger.warning(f"품목 정보 없음: {item_cd}")
            raise HTTPException(status_code=404, detail=f"품목을 찾을 수 없습니다: {item_cd}")

        # DataFrame 첫 번째 행을 딕셔너리로 변환
        result = df.iloc[0].to_dict()

        # NaN 값을 None으로 변환
        result = {k: (None if isinstance(v, float) and pd.isna(v) else v)
                  for k, v in result.items()}

        logger.info(f"품목 정보 반환: {item_cd}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"품목 정보 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"품목 정보 조회 실패: {str(e)}")


@router.get("/{item_cd}/properties")
async def get_item_properties(
    item_cd: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """
    품목 속성 정보 조회 (라우팅 생성 UI용)

    주요 속성만 선별하여 반환:
    - ITEM_CD, ITEM_NM, ITEM_SPEC
    - ITEM_GRP1, ITEM_GRP2, ITEM_GRP3
    - UNIT, ITEM_TYPE
    - 발주 정보 (있는 경우)

    Args:
        item_cd: 품목 코드

    Returns:
        품목 주요 속성 정보
    """
    logger.info(f"품목 속성 조회: item_cd={item_cd}, user={current_user.username}")

    try:
        df = fetch_item_with_purchase_info(item_cd)

        if df.empty:
            raise HTTPException(status_code=404, detail=f"품목을 찾을 수 없습니다: {item_cd}")

        item_data = df.iloc[0].to_dict()

        # 주요 속성만 선별
        properties = {
            "basic_info": {
                "ITEM_CD": item_data.get("ITEM_CD"),
                "ITEM_NM": item_data.get("ITEM_NM"),
                "ITEM_SPEC": item_data.get("ITEM_SPEC"),
                "UNIT": item_data.get("UNIT"),
                "ITEM_TYPE": item_data.get("ITEM_TYPE"),
                "DRAW_MP": item_data.get("DRAW_MP"),  # 도면 번호 추가
            },
            "classification": {
                "ITEM_GRP1": item_data.get("ITEM_GRP1"),
                "ITEM_GRP1NM": item_data.get("ITEM_GRP1NM"),
                "ITEM_GRP2": item_data.get("ITEM_GRP2"),
                "ITEM_GRP2NM": item_data.get("ITEM_GRP2NM"),
                "ITEM_GRP3": item_data.get("ITEM_GRP3"),
                "ITEM_GRP3NM": item_data.get("ITEM_GRP3NM"),
            },
            "purchase_info": {}
        }

        # 발주 정보 (있는 경우)
        if "PO_COUNT" in item_data and item_data["PO_COUNT"]:
            properties["purchase_info"] = {
                "PO_COUNT": item_data.get("PO_COUNT"),
                "LATEST_PO_NO": item_data.get("LATEST_PO_NO"),
                "LATEST_PO_DATE": item_data.get("LATEST_PO_DATE"),
                "LATEST_QTY": item_data.get("LATEST_QTY"),
                "LATEST_VENDOR_NM": item_data.get("LATEST_VENDOR_NM"),
            }

        # NaN 값을 None으로 변환
        import pandas as pd
        def clean_dict(d):
            return {k: (None if isinstance(v, float) and pd.isna(v) else
                       (clean_dict(v) if isinstance(v, dict) else v))
                   for k, v in d.items()}

        properties = clean_dict(properties)

        logger.info(f"품목 속성 반환: {item_cd}")
        return properties

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"품목 속성 조회 실패: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"품목 속성 조회 실패: {str(e)}")


@router.get("/{item_cd}/drawing-info")
async def get_drawing_info(
    item_cd: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """
    품목 도면 정보 조회 (ERP Image Viewer 연동용)

    MSSQL item_info 테이블에서 DRAW_NO와 DRAW_REV를 조회하여 반환합니다.
    ERP 도면 조회 기능에서 사용됩니다.

    Args:
        item_cd: 품목 코드

    Returns:
        {
            "drawingNumber": str,  # DRAW_NO (도면 번호)
            "revision": str,        # DRAW_REV (리비전)
            "sheetNumber": str,     # DRAW_SHEET_NO (시트 번호)
            "available": bool       # 도면 정보 존재 여부
        }
    """
    logger.info(f"도면 정보 조회: item_cd={item_cd}, user={current_user.username}")

    try:
        df = fetch_single_item(item_cd)

        if df.empty:
            logger.warning(f"품목 정보 없음 (도면 조회): {item_cd}")
            return {
                "drawingNumber": "",
                "revision": "",
                "sheetNumber": "",
                "available": False
            }

        item_data = df.iloc[0].to_dict()

        # DRAW_NO, DRAW_REV, DRAW_SHEET_NO 추출
        import pandas as pd
        draw_no = item_data.get("DRAW_NO")
        draw_rev = item_data.get("DRAW_REV")
        draw_sheet_no = item_data.get("DRAW_SHEET_NO")

        # NaN/None 체크
        draw_no_str = "" if (pd.isna(draw_no) or draw_no is None) else str(draw_no)
        draw_rev_str = "" if (pd.isna(draw_rev) or draw_rev is None) else str(draw_rev)
        draw_sheet_str = "" if (pd.isna(draw_sheet_no) or draw_sheet_no is None) else str(draw_sheet_no)

        # 도면 번호가 없으면 사용 불가
        available = bool(draw_no_str.strip())

        result = {
            "drawingNumber": draw_no_str,
            "revision": draw_rev_str,
            "sheetNumber": draw_sheet_str,
            "available": available
        }

        logger.info(f"도면 정보 반환: {item_cd}, available={available}")
        return result

    except Exception as e:
        logger.error(f"도면 정보 조회 실패: {e}", exc_info=True)
        # 에러 시에도 빈 응답 반환 (UI에서 "도면 없음"으로 처리)
        return {
            "drawingNumber": "",
            "revision": "",
            "sheetNumber": "",
            "available": False
        }


__all__ = ["router"]
