"""API routes for on-premises natural language search."""
from __future__ import annotations

from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.api.services.onprem_nlp_service import (
    OnPremNLPResponse,
    parse_onprem_nlp_query,
)

router = APIRouter(prefix="/onprem-nlp", tags=["onprem-nlp"])


# ============================================================================
# Request/Response Models
# ============================================================================


class NLPQueryRequest(BaseModel):
    """Request body for natural language query parsing."""

    query: str = Field(..., min_length=1, max_length=500, description="자연어 쿼리")

    class Config:
        json_schema_extra = {
            "example": {
                "query": "스테인리스 스틸 파이프 내경 50mm 라우팅 만들어줘"
            }
        }


class ExampleQuery(BaseModel):
    """Example natural language query with description."""

    query: str = Field(..., description="예시 쿼리")
    description: str = Field(..., description="쿼리 설명")
    expected_filters: Dict[str, str] = Field(..., description="추출될 필터 예상값")


class ServiceStatusResponse(BaseModel):
    """Service health status."""

    status: str = Field(..., description="서비스 상태 (healthy/degraded)")
    version: str = Field(..., description="서비스 버전")
    pattern_count: int = Field(..., description="등록된 패턴 수")
    capabilities: List[str] = Field(..., description="지원 기능 목록")


# ============================================================================
# Routes
# ============================================================================


@router.post("/query", response_model=OnPremNLPResponse)
async def parse_nlp_query(request: NLPQueryRequest) -> OnPremNLPResponse:
    """
    자연어 쿼리를 파싱하여 구조화된 필터로 변환합니다.

    **지원하는 쿼리 형식**:
    - 재질: "스테인리스", "알루미늄", "연강", "STS", "AL", "SM" 등
    - 품목 유형: "파이프", "플레이트", "씰", "PIPE", "PLATE", "SEAL" 등
    - 치수:
      - 단일 값: "내경 50mm", "외경 100mm"
      - 범위: "외경 100~200mm", "두께 10-20mm"
      - 부등호: "내경 50mm 이상", "외경 100mm 이하"
    - 도면번호: "DWG-12345", "도면번호 ABC-001"

    **예시**:
    ```
    Input: "스테인리스 파이프 내경 50mm 외경 100mm"
    Output:
    {
      "filters": {
        "material_code": "STS",
        "part_type": "PIPE",
        "inner_diameter_min": 50.0,
        "inner_diameter_max": 50.0,
        "outer_diameter_min": 100.0,
        "outer_diameter_max": 100.0
      },
      "confidence_score": 0.85,
      "matched_patterns": ["material:STS", "part_type:PIPE", ...],
      "sql_query": "SELECT * FROM items WHERE ..."
    }
    ```

    **정확도**: 70-75% (규칙 기반)
    """
    try:
        result = parse_onprem_nlp_query(request.query)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"NLP 파싱 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/examples", response_model=List[ExampleQuery])
async def get_example_queries() -> List[ExampleQuery]:
    """
    자연어 검색 예시 쿼리 목록을 반환합니다.

    사용자가 자연어 검색 기능을 처음 사용할 때 참고할 수 있는
    예시 쿼리들을 제공합니다.
    """
    examples = [
        ExampleQuery(
            query="스테인리스 스틸 파이프 라우팅 만들어줘",
            description="재질과 품목 유형 지정",
            expected_filters={
                "material_code": "STS",
                "part_type": "PIPE",
            },
        ),
        ExampleQuery(
            query="내경 50mm 씰 공정 추천해줘",
            description="치수와 품목 유형 지정",
            expected_filters={
                "part_type": "SEAL",
                "inner_diameter": "50mm",
            },
        ),
        ExampleQuery(
            query="도면번호 DWG-12345 품목 찾아줘",
            description="도면번호로 검색",
            expected_filters={
                "drawing_number": "DWG-12345",
            },
        ),
        ExampleQuery(
            query="알루미늄 표준품 외경 100mm 이하",
            description="재질, 표준품 여부, 치수 범위 지정",
            expected_filters={
                "material_code": "AL",
                "is_standard": "true",
                "outer_diameter": "≤100mm",
            },
        ),
        ExampleQuery(
            query="외경 200mm 내경 150mm 파이프",
            description="복수 치수 지정",
            expected_filters={
                "part_type": "PIPE",
                "outer_diameter": "200mm",
                "inner_diameter": "150mm",
            },
        ),
        ExampleQuery(
            query="연강 플레이트 두께 10~20mm",
            description="재질, 품목, 치수 범위 지정",
            expected_filters={
                "material_code": "SM",
                "part_type": "PLATE",
                "thickness": "10-20mm",
            },
        ),
        ExampleQuery(
            query="황동 샤프트 외경 30mm 이상",
            description="재질, 품목, 최소 치수 지정",
            expected_filters={
                "material_code": "BRASS",
                "part_type": "SHAFT",
                "outer_diameter": "≥30mm",
            },
        ),
        ExampleQuery(
            query="SUS304 표준품",
            description="재질 상세 코드와 표준품 여부",
            expected_filters={
                "material_code": "SUS304",
                "is_standard": "true",
            },
        ),
    ]
    return examples


@router.get("/status", response_model=ServiceStatusResponse)
async def get_service_status() -> ServiceStatusResponse:
    """
    온프레미스 NLP 서비스의 상태를 반환합니다.

    외부 API 의존성이 없는 로컬 서비스이므로 항상 healthy 상태입니다.
    """
    from backend.api.services.onprem_nlp_service import (
        MATERIAL_PATTERNS,
        PART_TYPE_PATTERNS,
    )

    pattern_count = len(MATERIAL_PATTERNS) + len(PART_TYPE_PATTERNS)

    return ServiceStatusResponse(
        status="healthy",
        version="1.0.0",
        pattern_count=pattern_count,
        capabilities=[
            "재질 코드 추출 (15+ materials)",
            "품목 유형 추출 (9+ part types)",
            "치수 추출 (단일값, 범위, 부등호)",
            "도면번호 추출",
            "표준품 여부 판별",
            "신뢰도 점수 계산",
            "SQL 쿼리 자동 생성",
        ],
    )


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """간단한 헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "onprem-nlp"}
