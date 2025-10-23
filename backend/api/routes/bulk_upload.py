"""대량 업로드 API - 엑셀/CSV 파일로 라우팅 그룹 일괄 생성."""
from __future__ import annotations

import io
from typing import Any, Dict, List

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from backend.api.schemas import (
    AuthenticatedUser,
    BulkUploadPreviewResponse,
    BulkUploadPreviewRow,
    BulkUploadResponse,
    BulkUploadValidationError,
)
from backend.api.security import require_admin
from common.logger import get_logger, audit_routing_event

router = APIRouter(prefix="/api/bulk-upload", tags=["bulk-upload"])
logger = get_logger("api.bulk_upload")


def parse_excel_file(file_content: bytes) -> List[Dict[str, Any]]:
    """엑셀 파일 파싱"""
    try:
        df = pd.read_excel(io.BytesIO(file_content))
        return df.to_dict('records')
    except Exception as e:
        logger.error(f"엑셀 파일 파싱 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"엑셀 파일 파싱 실패: {str(e)}",
        ) from e


def parse_csv_file(file_content: bytes, encoding: str = 'utf-8') -> List[Dict[str, Any]]:
    """CSV 파일 파싱"""
    try:
        df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
        return df.to_dict('records')
    except Exception as e:
        logger.error(f"CSV 파일 파싱 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV 파일 파싱 실패: {str(e)}",
        ) from e


def validate_routing_row(row: Dict[str, Any], row_index: int) -> List[BulkUploadValidationError]:
    """라우팅 행 검증"""
    errors = []

    # 필수 컬럼 체크
    required_columns = ['라우팅명', '순서']
    for col in required_columns:
        if col not in row or pd.isna(row[col]) or str(row[col]).strip() == '':
            errors.append(
                BulkUploadValidationError(
                    row=row_index,
                    column=col,
                    error=f"필수 컬럼 '{col}'이(가) 비어있습니다",
                    value=None,
                )
            )

    # 순서가 숫자인지 체크
    if '순서' in row and not pd.isna(row['순서']):
        try:
            seq = int(row['순서'])
            if seq < 1:
                errors.append(
                    BulkUploadValidationError(
                        row=row_index,
                        column='순서',
                        error="순서는 1 이상이어야 합니다",
                        value=str(row['순서']),
                    )
                )
        except (ValueError, TypeError):
            errors.append(
                BulkUploadValidationError(
                    row=row_index,
                    column='순서',
                    error="순서는 숫자여야 합니다",
                    value=str(row['순서']),
                )
            )

    return errors


@router.post("/preview", response_model=BulkUploadPreviewResponse)
async def preview_bulk_upload(
    file: UploadFile = File(..., description="엑셀 또는 CSV 파일"),
    encoding: str = 'utf-8',
    current_user: AuthenticatedUser = Depends(require_admin),
) -> BulkUploadPreviewResponse:
    """대량 업로드 미리보기"""
    logger.info(
        "대량 업로드 미리보기 시작",
        extra={
            "username": current_user.username,
            "filename": file.filename,
            "content_type": file.content_type,
        },
    )

    # 파일 읽기
    content = await file.read()

    # 파일 타입에 따라 파싱
    if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
        rows = parse_excel_file(content)
    elif file.filename.endswith('.csv'):
        rows = parse_csv_file(content, encoding=encoding)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일만 업로드 가능합니다",
        )

    # 데이터 검증
    all_errors: List[BulkUploadValidationError] = []
    preview_rows: List[BulkUploadPreviewRow] = []

    # 라우팅 코드별로 그룹화
    routing_groups: Dict[str, List[Dict[str, Any]]] = {}

    for idx, row in enumerate(rows, start=2):  # 엑셀 행 번호는 헤더 다음부터 시작
        row_errors = validate_routing_row(row, idx)
        all_errors.extend(row_errors)

        routing_code = str(row.get('라우팅명', '')).strip()
        if routing_code:
            if routing_code not in routing_groups:
                routing_groups[routing_code] = []
            routing_groups[routing_code].append(row)

    # 미리보기 데이터 생성
    for routing_code, steps in routing_groups.items():
        # 품목 코드 추출 (첫 번째 행에서)
        item_codes = []
        if steps:
            first_row = steps[0]
            # 품목 코드가 있을 수 있는 컬럼들 확인
            for col_name in ['품목코드', '품목_코드', 'ITEM_CD', 'ITEM_CODE']:
                if col_name in first_row and not pd.isna(first_row[col_name]):
                    item_codes.append(str(first_row[col_name]).strip())

        preview_rows.append(
            BulkUploadPreviewRow(
                routing_code=routing_code,
                item_codes=item_codes if item_codes else [],
                step_count=len(steps),
                has_errors=any(
                    err.value == routing_code or (err.row >= 0 and rows[err.row - 2].get('라우팅명') == routing_code)
                    for err in all_errors
                    if err.row >= 2 and err.row - 2 < len(rows)
                ),
                errors=[],
            )
        )

    valid_rows = len([r for r in preview_rows if not r.has_errors])
    error_rows = len(preview_rows) - valid_rows

    # 컬럼 매핑 정보
    column_mapping = {}
    if rows:
        column_mapping = {col: col for col in rows[0].keys()}

    audit_routing_event(
        "대량_업로드_미리보기",
        payload={
            "filename": file.filename,
            "total_rows": len(rows),
            "routing_groups": len(routing_groups),
            "valid_rows": valid_rows,
            "error_rows": error_rows,
        },
        username=current_user.username,
    )

    return BulkUploadPreviewResponse(
        total_rows=len(rows),
        valid_rows=valid_rows,
        error_rows=error_rows,
        preview=preview_rows[:50],  # 최대 50개만 미리보기
        errors=all_errors[:100],  # 최대 100개 오류만 표시
        column_mapping=column_mapping,
    )


@router.post("/execute", response_model=BulkUploadResponse)
async def execute_bulk_upload(
    file: UploadFile = File(..., description="엑셀 또는 CSV 파일"),
    encoding: str = 'utf-8',
    current_user: AuthenticatedUser = Depends(require_admin),
) -> BulkUploadResponse:
    """대량 업로드 실행"""
    logger.info(
        "대량 업로드 실행 시작",
        extra={
            "username": current_user.username,
            "filename": file.filename,
        },
    )

    # 파일 읽기
    content = await file.read()

    # 파일 타입에 따라 파싱
    if file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
        rows = parse_excel_file(content)
    elif file.filename.endswith('.csv'):
        rows = parse_csv_file(content, encoding=encoding)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="지원하지 않는 파일 형식입니다",
        )

    # 데이터 검증
    all_errors: List[BulkUploadValidationError] = []
    for idx, row in enumerate(rows, start=2):
        row_errors = validate_routing_row(row, idx)
        all_errors.extend(row_errors)

    if all_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"검증 오류가 발생했습니다. 총 {len(all_errors)}개 오류",
        )

    # 실제 라우팅 그룹 생성
    from backend.models.routing_groups import session_scope, RoutingGroup
    from backend.schemas.routing_groups import RoutingStep

    # 라우팅 코드별로 그룹화
    routing_groups: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        routing_code = str(row.get('라우팅명', '')).strip()
        if routing_code:
            if routing_code not in routing_groups:
                routing_groups[routing_code] = []
            routing_groups[routing_code].append(row)

    created_ids: List[str] = []
    created = 0
    skipped = 0
    creation_errors: List[BulkUploadValidationError] = []

    with session_scope() as session:
        for routing_code, steps_data in routing_groups.items():
            try:
                # 품목 코드 추출
                item_codes = []
                for col_name in ['품목코드', '품목_코드', 'ITEM_CD', 'ITEM_CODE']:
                    if col_name in steps_data[0] and not pd.isna(steps_data[0][col_name]):
                        code = str(steps_data[0][col_name]).strip()
                        if code and code not in item_codes:
                            item_codes.append(code)

                # 스텝 데이터 변환
                steps = []
                for idx, step_data in enumerate(steps_data):
                    seq = int(step_data.get('순서', idx + 1))
                    step = RoutingStep(
                        seq=seq,
                        operation=str(step_data.get('작업', '')).strip(),
                        work_center=str(step_data.get('작업장', '')).strip() if '작업장' in step_data else None,
                        duration_minutes=int(step_data.get('소요시간', 0)) if '소요시간' in step_data else None,
                        notes=str(step_data.get('비고', '')).strip() if '비고' in step_data else None,
                    )
                    steps.append(step)

                # 라우팅 그룹 생성
                group = RoutingGroup(
                    group_name=routing_code,
                    owner=current_user.username,
                    item_codes=item_codes,
                    steps=[step.dict() for step in sorted(steps, key=lambda s: s.seq)],
                    erp_required=False,
                    metadata_payload={"bulk_upload": True, "filename": file.filename},
                )

                session.add(group)
                session.flush()
                session.refresh(group)

                created_ids.append(group.id)
                created += 1

                logger.info(
                    f"라우팅 그룹 생성: {routing_code}",
                    extra={
                        "group_id": group.id,
                        "item_codes": item_codes,
                        "step_count": len(steps),
                    },
                )

            except Exception as e:
                skipped += 1
                creation_errors.append(
                    BulkUploadValidationError(
                        row=0,
                        column="라우팅명",
                        error=f"라우팅 그룹 생성 실패: {str(e)}",
                        value=routing_code,
                    )
                )
                logger.error(f"라우팅 그룹 생성 실패: {routing_code} - {e}", exc_info=True)

    audit_routing_event(
        "대량_업로드_실행",
        payload={
            "filename": file.filename,
            "total_groups": len(routing_groups),
            "created": created,
            "skipped": skipped,
        },
        result="success" if created > 0 else "partial",
        username=current_user.username,
    )

    return BulkUploadResponse(
        created=created,
        updated=0,
        skipped=skipped,
        errors=creation_errors,
        created_ids=created_ids,
    )


__all__ = ["router"]


