"""
온프레미스 자연어 검색 서비스 (규칙 기반)

외부 API 의존성 없이 내부망에서 작동하는 자연어 쿼리 파서
정규식 + 키워드 매칭 + 품목 코드 사전 활용

예시:
- "스테인리스 스틸 파이프 라우팅 만들어줘" → {item_material: "STS", part_type: "PIPE"}
- "내경 50mm 씰 공정 추천해줘" → {indiameter_min: 50.0, sealtypegrup: "SEAL"}
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ============================================================================
# Pydantic Models
# ============================================================================


class OnPremNLPQuery(BaseModel):
    """자연어 쿼리 입력"""
    query: str = Field(..., description="사용자의 자연어 쿼리", min_length=1)


class ExtractedFilters(BaseModel):
    """추출된 검색 필터"""
    item_material: Optional[str] = Field(None, description="소재 (예: STS, AL, SM)")
    part_type: Optional[str] = Field(None, description="부품 유형 (예: PIPE, PLATE)")
    item_grp1: Optional[str] = Field(None, description="품목 그룹1")
    indiameter_min: Optional[float] = Field(None, description="내경 최소값 (mm)")
    indiameter_max: Optional[float] = Field(None, description="내경 최대값 (mm)")
    outdiameter_min: Optional[float] = Field(None, description="외경 최소값 (mm)")
    outdiameter_max: Optional[float] = Field(None, description="외경 최대값 (mm)")
    outthickness_min: Optional[float] = Field(None, description="두께 최소값 (mm)")
    outthickness_max: Optional[float] = Field(None, description="두께 최대값 (mm)")
    sealtypegrup: Optional[str] = Field(None, description="씰 타입 그룹")
    standard_yn: Optional[str] = Field(None, description="표준품 여부 (Y/N)")
    draw_no: Optional[str] = Field(None, description="도면 번호")
    keywords: List[str] = Field(default_factory=list, description="추가 키워드")


class OnPremNLPResponse(BaseModel):
    """자연어 처리 응답"""
    success: bool = Field(..., description="처리 성공 여부")
    original_query: str = Field(..., description="원본 쿼리")
    extracted_filters: ExtractedFilters = Field(..., description="추출된 필터")
    confidence: float = Field(..., description="신뢰도 (0~1)", ge=0.0, le=1.0)
    matched_patterns: List[str] = Field(default_factory=list, description="매칭된 패턴")
    explanation: str = Field(..., description="처리 설명")


# ============================================================================
# 소재 코드 매핑 (한글/영문 → 코드)
# ============================================================================

MATERIAL_PATTERNS = {
    # 스테인리스
    r"스테인리스|stainless|sts|sus|SUS304|SUS316": "STS",
    # 알루미늄
    r"알루미늄|aluminum|aluminium|al|AL6061": "AL",
    # 연강 (Mild Steel)
    r"연강|mild\s*steel|sm|SM45C|SM20C": "SM",
    # 황동
    r"황동|brass|C3604": "BRASS",
    # 구리
    r"구리|copper|cu": "CU",
    # 주철
    r"주철|cast\s*iron|FCD": "CI",
    # 탄소강
    r"탄소강|carbon\s*steel|S45C|S50C": "CS",
    # 공구강
    r"공구강|tool\s*steel|SKD|SKH": "TS",
}

# ============================================================================
# 부품 유형 매핑
# ============================================================================

PART_TYPE_PATTERNS = {
    # 파이프
    r"파이프|pipe|튜브|tube": "PIPE",
    # 플레이트
    r"플레이트|plate|판|판재": "PLATE",
    # 씰
    r"씰|seal|오링|o-ring": "SEAL",
    # 샤프트
    r"샤프트|shaft|축": "SHAFT",
    # 플랜지
    r"플랜지|flange": "FLANGE",
    # 베어링
    r"베어링|bearing": "BEARING",
    # 기어
    r"기어|gear": "GEAR",
    # 볼트/너트
    r"볼트|bolt|너트|nut": "FASTENER",
    # 밸브
    r"밸브|valve": "VALVE",
}

# ============================================================================
# 품목 그룹 매핑
# ============================================================================

ITEM_GRP1_PATTERNS = {
    r"가공|machining": "MACHINING",
    r"후처리|post.*process|도금|plating": "POST_PROCESSING",
    r"조립|assembly": "ASSEMBLY",
    r"검사|inspection|품질": "INSPECTION",
}

# ============================================================================
# 정규식 패턴
# ============================================================================

# 치수 추출 패턴
DIAMETER_PATTERNS = {
    # "내경 50mm", "ID 50", "내경50"
    "indiameter": r"내경|ID|inner\s*dia(?:meter)?",
    # "외경 100mm", "OD 100", "외경100"
    "outdiameter": r"외경|OD|outer\s*dia(?:meter)?",
    # "두께 5mm", "thickness 5"
    "outthickness": r"두께|thickness|thick",
}

# 숫자 추출: "50mm", "50", "50.5mm"
NUMBER_PATTERN = r"(\d+(?:\.\d+)?)"

# 도면 번호: "DWG-12345", "도면 A-123", "drawing 001"
DRAW_NO_PATTERN = r"(?:DWG|도면|drawing)[-\s]*([A-Z0-9\-]+)"

# 표준품 키워드
STANDARD_PATTERN = r"표준품|standard|규격품"

# ============================================================================
# 키워드 추출 함수
# ============================================================================


def extract_material(query: str) -> Optional[str]:
    """소재 추출"""
    for pattern, code in MATERIAL_PATTERNS.items():
        if re.search(pattern, query, re.IGNORECASE):
            logger.debug(f"Material matched: {pattern} → {code}")
            return code
    return None


def extract_part_type(query: str) -> Optional[str]:
    """부품 유형 추출"""
    for pattern, code in PART_TYPE_PATTERNS.items():
        if re.search(pattern, query, re.IGNORECASE):
            logger.debug(f"Part type matched: {pattern} → {code}")
            return code
    return None


def extract_item_grp1(query: str) -> Optional[str]:
    """품목 그룹1 추출"""
    for pattern, code in ITEM_GRP1_PATTERNS.items():
        if re.search(pattern, query, re.IGNORECASE):
            logger.debug(f"Item group matched: {pattern} → {code}")
            return code
    return None


def extract_diameter(query: str, diameter_type: str) -> Optional[tuple[float, float]]:
    """
    치수 추출 (범위 또는 단일값)

    Examples:
        "내경 50mm" → (50.0, 50.0)
        "외경 100~200mm" → (100.0, 200.0)
        "두께 5mm 이상" → (5.0, None)
        "내경 30mm 이하" → (None, 30.0)
    """
    pattern = DIAMETER_PATTERNS.get(diameter_type)
    if not pattern:
        return None

    # 1. 해당 치수 타입 찾기
    match = re.search(f"{pattern}[\\s:]*", query, re.IGNORECASE)
    if not match:
        return None

    # 2. 치수 타입 이후의 텍스트 추출
    rest_text = query[match.end():]

    # 3. 범위 패턴: "100~200", "100-200", "100 to 200"
    range_match = re.search(rf"{NUMBER_PATTERN}\s*[~\-]|to\s*{NUMBER_PATTERN}", rest_text, re.IGNORECASE)
    if range_match:
        min_val = float(range_match.group(1))
        max_val = float(range_match.group(2))
        logger.debug(f"{diameter_type} range: {min_val} ~ {max_val}")
        return (min_val, max_val)

    # 4. "이상" 패턴: "50mm 이상", ">= 50"
    min_match = re.search(rf"{NUMBER_PATTERN}\s*(?:mm)?\s*이상|>=\s*{NUMBER_PATTERN}", rest_text)
    if min_match:
        min_val = float(min_match.group(1))
        logger.debug(f"{diameter_type} >= {min_val}")
        return (min_val, None)

    # 5. "이하" 패턴: "50mm 이하", "<= 50"
    max_match = re.search(rf"{NUMBER_PATTERN}\s*(?:mm)?\s*이하|<=\s*{NUMBER_PATTERN}", rest_text)
    if max_match:
        max_val = float(max_match.group(1))
        logger.debug(f"{diameter_type} <= {max_val}")
        return (None, max_val)

    # 6. 단일 값: "50mm", "50"
    single_match = re.search(rf"{NUMBER_PATTERN}", rest_text)
    if single_match:
        value = float(single_match.group(1))
        logger.debug(f"{diameter_type} = {value}")
        return (value, value)

    return None


def extract_draw_no(query: str) -> Optional[str]:
    """도면 번호 추출"""
    match = re.search(DRAW_NO_PATTERN, query, re.IGNORECASE)
    if match:
        draw_no = match.group(1).strip()
        logger.debug(f"Drawing number: {draw_no}")
        return draw_no
    return None


def extract_standard_yn(query: str) -> Optional[str]:
    """표준품 여부 추출"""
    if re.search(STANDARD_PATTERN, query, re.IGNORECASE):
        logger.debug("Standard item: Y")
        return "Y"
    return None


def extract_keywords(query: str) -> List[str]:
    """일반 키워드 추출 (공백 기준)"""
    # 특수문자 제거 후 단어 분리
    words = re.findall(r"[\w가-힣]+", query)
    # 2글자 이상만 키워드로 추출
    keywords = [w for w in words if len(w) >= 2]
    return keywords


# ============================================================================
# 메인 파서 함수
# ============================================================================


def parse_onprem_nlp_query(query: str) -> OnPremNLPResponse:
    """
    온프레미스 자연어 쿼리 파싱

    Args:
        query: 사용자의 자연어 쿼리

    Returns:
        OnPremNLPResponse: 파싱 결과
    """
    logger.info(f"Parsing query: {query}")

    matched_patterns = []
    filters = ExtractedFilters()

    # 1. 소재 추출
    material = extract_material(query)
    if material:
        filters.item_material = material
        matched_patterns.append(f"소재: {material}")

    # 2. 부품 유형 추출
    part_type = extract_part_type(query)
    if part_type:
        filters.part_type = part_type
        matched_patterns.append(f"부품 유형: {part_type}")

    # 3. 품목 그룹 추출
    item_grp1 = extract_item_grp1(query)
    if item_grp1:
        filters.item_grp1 = item_grp1
        matched_patterns.append(f"품목 그룹: {item_grp1}")

    # 4. 내경 추출
    indiameter = extract_diameter(query, "indiameter")
    if indiameter:
        filters.indiameter_min, filters.indiameter_max = indiameter
        matched_patterns.append(f"내경: {indiameter}")

    # 5. 외경 추출
    outdiameter = extract_diameter(query, "outdiameter")
    if outdiameter:
        filters.outdiameter_min, filters.outdiameter_max = outdiameter
        matched_patterns.append(f"외경: {outdiameter}")

    # 6. 두께 추출
    outthickness = extract_diameter(query, "outthickness")
    if outthickness:
        filters.outthickness_min, filters.outthickness_max = outthickness
        matched_patterns.append(f"두께: {outthickness}")

    # 7. 씰 타입 (부품 유형이 SEAL이면 자동 설정)
    if part_type == "SEAL":
        filters.sealtypegrup = "SEAL"

    # 8. 도면 번호 추출
    draw_no = extract_draw_no(query)
    if draw_no:
        filters.draw_no = draw_no
        matched_patterns.append(f"도면 번호: {draw_no}")

    # 9. 표준품 여부
    standard_yn = extract_standard_yn(query)
    if standard_yn:
        filters.standard_yn = standard_yn
        matched_patterns.append("표준품")

    # 10. 일반 키워드
    filters.keywords = extract_keywords(query)

    # 신뢰도 계산 (매칭된 패턴 수 기반)
    confidence = min(len(matched_patterns) / 5.0, 1.0)  # 최대 5개 패턴 기준

    # 설명 생성
    if matched_patterns:
        explanation = f"{len(matched_patterns)}개 필터 추출 완료: " + ", ".join(matched_patterns)
    else:
        explanation = "매칭된 패턴이 없습니다. 키워드 검색을 사용합니다."
        confidence = 0.3

    logger.info(f"Parsing result: {len(matched_patterns)} patterns matched, confidence={confidence:.2f}")

    return OnPremNLPResponse(
        success=True,
        original_query=query,
        extracted_filters=filters,
        confidence=confidence,
        matched_patterns=matched_patterns,
        explanation=explanation,
    )


# ============================================================================
# SQL 쿼리 생성
# ============================================================================


def generate_sql_from_filters(filters: ExtractedFilters, table_name: str = "item_master") -> str:
    """
    추출된 필터를 SQL WHERE 절로 변환

    Args:
        filters: 추출된 검색 필터
        table_name: 테이블 이름

    Returns:
        str: SQL WHERE 절
    """
    conditions = []

    if filters.item_material:
        conditions.append(f"item_material = '{filters.item_material}'")

    if filters.part_type:
        conditions.append(f"part_type = '{filters.part_type}'")

    if filters.item_grp1:
        conditions.append(f"item_grp1 = '{filters.item_grp1}'")

    if filters.indiameter_min is not None:
        conditions.append(f"indiameter >= {filters.indiameter_min}")

    if filters.indiameter_max is not None:
        conditions.append(f"indiameter <= {filters.indiameter_max}")

    if filters.outdiameter_min is not None:
        conditions.append(f"outdiameter >= {filters.outdiameter_min}")

    if filters.outdiameter_max is not None:
        conditions.append(f"outdiameter <= {filters.outdiameter_max}")

    if filters.outthickness_min is not None:
        conditions.append(f"outthickness >= {filters.outthickness_min}")

    if filters.outthickness_max is not None:
        conditions.append(f"outthickness <= {filters.outthickness_max}")

    if filters.sealtypegrup:
        conditions.append(f"sealtypegrup = '{filters.sealtypegrup}'")

    if filters.standard_yn:
        conditions.append(f"standard_yn = '{filters.standard_yn}'")

    if filters.draw_no:
        conditions.append(f"draw_no = '{filters.draw_no}'")

    # 키워드 검색 (LIKE)
    if filters.keywords:
        keyword_conditions = " OR ".join([f"item_nm LIKE '%{kw}%'" for kw in filters.keywords[:5]])
        conditions.append(f"({keyword_conditions})")

    where_clause = " AND ".join(conditions) if conditions else "1=1"
    sql = f"SELECT * FROM {table_name} WHERE {where_clause} LIMIT 100"

    return sql


# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    # Test cases
    test_queries = [
        "스테인리스 스틸 파이프 라우팅 만들어줘",
        "내경 50mm 씰 공정 추천해줘",
        "도면번호 DWG-12345 품목 찾아줘",
        "알루미늄 표준품 외경 100mm 이하",
        "외경 200mm 내경 150mm 파이프",
        "연강 플레이트 두께 10~20mm",
    ]

    for query in test_queries:
        print(f"\n쿼리: {query}")
        print("=" * 80)
        result = parse_onprem_nlp_query(query)
        print(f"신뢰도: {result.confidence:.2f}")
        print(f"설명: {result.explanation}")
        print(f"필터: {result.extracted_filters.dict(exclude_none=True)}")
        print(f"SQL: {generate_sql_from_filters(result.extracted_filters)}")
