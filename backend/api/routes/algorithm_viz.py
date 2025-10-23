"""
알고리즘 시각화 API 라우터

Python 파일 분석 및 노드/엣지 데이터 제공
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from backend.api.security import require_admin
from pydantic import BaseModel

from backend.ml.code_analyzer import FileAnalysis, analyze_python_file, list_python_files
from common.logger import get_logger

router = APIRouter(prefix="/api/algorithm-viz", tags=["algorithm-visualization"], dependencies=[Depends(require_admin)])
logger = get_logger(__name__)


class NodeData(BaseModel):
    """React Flow 노드 데이터"""

    id: str
    type: str  # "function" | "class"
    position: dict[str, float]
    data: dict[str, Any]


class EdgeData(BaseModel):
    """React Flow 엣지 데이터"""

    id: str
    source: str
    target: str
    label: str | None = None
    animated: bool = False


class AnalysisResponse(BaseModel):
    """파일 분석 응답"""

    file_path: str
    nodes: list[NodeData]
    edges: list[EdgeData]
    raw_analysis: FileAnalysis


class FileListItem(BaseModel):
    """파일 목록 아이템"""

    id: str
    name: str
    path: str
    full_path: str
    size: int
    functions: int
    classes: int
    type: str  # "training" | "prediction" | "common"


@router.get("/files", response_model=list[FileListItem])
async def get_python_files(
    directory: str = Query(default="backend", description="검색할 디렉토리"),
    include_training: bool = Query(default=True, description="훈련 관련 파일 포함"),
    include_prediction: bool = Query(default=True, description="예측 관련 파일 포함"),
) -> list[FileListItem]:
    """
    Python 파일 목록을 반환합니다.

    Args:
        directory: 검색할 디렉토리 (backend, common 등)
        include_training: trainer 관련 파일 포함 여부
        include_prediction: predictor 관련 파일 포함 여부

    Returns:
        파일 목록
    """
    try:
        # 프로젝트 루트 기준으로 경로 설정
        project_root = Path(__file__).parent.parent.parent.parent
        search_dir = project_root / directory

        if not search_dir.exists():
            logger.warning(f"디렉토리를 찾을 수 없습니다: {search_dir}")
            return []

        files = list_python_files(str(search_dir))

        # 파일 타입 분류
        result = []
        for file in files:
            file_name_lower = file["name"].lower()

            # 타입 결정
            if "train" in file_name_lower:
                file_type = "training"
                if not include_training:
                    continue
            elif "predict" in file_name_lower:
                file_type = "prediction"
                if not include_prediction:
                    continue
            else:
                file_type = "common"

            result.append(
                FileListItem(
                    id=file["id"],
                    name=file["name"],
                    path=file["path"],
                    full_path=file["full_path"],
                    size=file["size"],
                    functions=file["functions"],
                    classes=file["classes"],
                    type=file_type,
                )
            )

        logger.info(f"Python 파일 {len(result)}개 반환: {directory}")
        return result

    except Exception as e:
        logger.error(f"파일 목록 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"파일 목록 조회 실패: {str(e)}")


@router.get("/summary", response_model=AnalysisResponse)
async def get_project_summary() -> AnalysisResponse:
    """
    전체 프로젝트의 파일 간 관계를 요약하여 반환합니다.

    Returns:
        프로젝트 전체 구조를 나타내는 노드/엣지
    """
    try:
        # 주요 파일들의 관계 정의 (하드코딩)
        nodes: list[NodeData] = []
        edges: list[EdgeData] = []

        # Training 파이프라인 노드들
        nodes.append(NodeData(
            id="trainer_ml",
            type="module",
            position={"x": 100, "y": 100},
            data={
                "label": "trainer_ml.py",
                "type": "module",
                "description": "모델 학습 메인 모듈 (32 functions)",
                "category": "training"
            }
        ))

        nodes.append(NodeData(
            id="training_service",
            type="module",
            position={"x": 400, "y": 100},
            data={
                "label": "training_service.py",
                "type": "module",
                "description": "학습 서비스 API (17 functions)",
                "category": "training"
            }
        ))

        # Prediction 파이프라인 노드들
        nodes.append(NodeData(
            id="predictor_ml",
            type="module",
            position={"x": 100, "y": 300},
            data={
                "label": "predictor_ml.py",
                "type": "module",
                "description": "예측 메인 모듈 (51 functions)",
                "category": "prediction"
            }
        ))

        nodes.append(NodeData(
            id="prediction_service",
            type="module",
            position={"x": 400, "y": 300},
            data={
                "label": "prediction_service.py",
                "type": "module",
                "description": "예측 서비스 API (56 functions)",
                "category": "prediction"
            }
        ))

        # 공통 모듈들
        nodes.append(NodeData(
            id="database",
            type="module",
            position={"x": 700, "y": 200},
            data={
                "label": "database.py",
                "type": "module",
                "description": "데이터베이스 연결/쿼리 (54 functions)",
                "category": "common"
            }
        ))

        nodes.append(NodeData(
            id="feature_weights",
            type="module",
            position={"x": 250, "y": 500},
            data={
                "label": "feature_weights.py",
                "type": "module",
                "description": "피처 중요도 분석 (24 functions)",
                "category": "common"
            }
        ))

        # 엣지 (파일 간 관계)
        edges.append(EdgeData(
            id="trainer-training_service",
            source="trainer_ml",
            target="training_service",
            label="API 호출",
            animated=True
        ))

        edges.append(EdgeData(
            id="predictor-prediction_service",
            source="predictor_ml",
            target="prediction_service",
            label="API 호출",
            animated=True
        ))

        edges.append(EdgeData(
            id="training_service-database",
            source="training_service",
            target="database",
            label="DB 조회",
            animated=True
        ))

        edges.append(EdgeData(
            id="prediction_service-database",
            source="prediction_service",
            target="database",
            label="DB 조회",
            animated=True
        ))

        edges.append(EdgeData(
            id="trainer-feature_weights",
            source="trainer_ml",
            target="feature_weights",
            label="피처 분석",
            animated=True
        ))

        edges.append(EdgeData(
            id="predictor-feature_weights",
            source="predictor_ml",
            target="feature_weights",
            label="피처 사용",
            animated=True
        ))

        return AnalysisResponse(
            file_path="PROJECT_SUMMARY",
            nodes=nodes,
            edges=edges,
            raw_analysis=FileAnalysis(
                file_path="PROJECT_SUMMARY",
                functions=[],
                classes=[],
                calls=[],
                imports=[],
                errors=[]
            )
        )

    except Exception as e:
        logger.error(f"프로젝트 요약 생성 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"프로젝트 요약 생성 실패: {str(e)}")


@router.get("/analyze", response_model=AnalysisResponse)
async def analyze_file(
    file_path: str = Query(..., description="분석할 Python 파일 절대 경로")
) -> AnalysisResponse:
    """
    Python 파일을 분석하여 노드/엣지 데이터를 반환합니다.

    Args:
        file_path: 분석할 파일의 절대 경로

    Returns:
        분석 결과 (노드, 엣지, 원본 분석 데이터)
    """
    try:
        # 보안: 상대 경로 공격 방지
        file_path_obj = Path(file_path).resolve()
        project_root = Path(__file__).parent.parent.parent.parent
        if not str(file_path_obj).startswith(str(project_root)):
            raise HTTPException(status_code=403, detail="프로젝트 외부 파일 접근 금지")

        # 파일 분석
        analysis = analyze_python_file(str(file_path_obj))

        if analysis.errors:
            logger.warning(f"파일 분석 중 오류 발생: {file_path_obj.name}, 오류: {analysis.errors}")

        # 소스 파일 읽기
        source_lines = []
        try:
            with open(file_path_obj, "r", encoding="utf-8") as f:
                source_lines = f.readlines()
        except Exception as e:
            logger.error(f"소스 파일 읽기 실패: {str(e)}")

        # 노드 생성
        nodes: list[NodeData] = []
        y_offset = 100

        # 함수 노드
        for idx, func in enumerate(analysis.functions):
            # 소스 코드 추출 (line_start-1 부터 line_end 까지, 0-indexed)
            source_code = ""
            if source_lines and func.line_start > 0 and func.line_end <= len(source_lines):
                source_code = "".join(source_lines[func.line_start - 1 : func.line_end])

            nodes.append(
                NodeData(
                    id=f"func-{func.name}",
                    type="function",
                    position={"x": 100, "y": y_offset + idx * 200},
                    data={
                        "label": func.name,
                        "fileName": file_path_obj.name,
                        "type": "function",
                        "parameters": func.parameters,
                        "returnType": func.return_annotation,
                        "docstring": func.docstring,
                        "decorators": func.decorators,
                        "isAsync": func.is_async,
                        "lineStart": func.line_start,
                        "lineEnd": func.line_end,
                        "sourceCode": source_code,
                    },
                )
            )

        # 클래스 노드
        for idx, cls in enumerate(analysis.classes):
            # 클래스 소스 코드 추출
            source_code = ""
            if source_lines and cls.line_start > 0 and cls.line_end <= len(source_lines):
                source_code = "".join(source_lines[cls.line_start - 1 : cls.line_end])

            nodes.append(
                NodeData(
                    id=f"class-{cls.name}",
                    type="function",  # React Flow에서는 같은 타입 사용
                    position={"x": 500, "y": y_offset + idx * 200},
                    data={
                        "label": cls.name,
                        "fileName": file_path_obj.name,
                        "type": "class",
                        "bases": cls.bases,
                        "methods": cls.methods,
                        "docstring": cls.docstring,
                        "decorators": cls.decorators,
                        "lineStart": cls.line_start,
                        "lineEnd": cls.line_end,
                        "sourceCode": source_code,
                    },
                )
            )

        # 엣지 생성 (함수 호출 관계)
        edges: list[EdgeData] = []
        for call in analysis.calls:
            # caller와 callee가 모두 노드로 존재하는지 확인
            caller_id = f"func-{call.caller}"
            callee_id = f"func-{call.callee}"

            caller_exists = any(node.id == caller_id for node in nodes)
            callee_exists = any(node.id == callee_id for node in nodes)

            if caller_exists and callee_exists:
                edge_id = f"{caller_id}-{callee_id}-{call.line}"
                edges.append(
                    EdgeData(
                        id=edge_id,
                        source=caller_id,
                        target=callee_id,
                        label=f"line {call.line}",
                        animated=True,
                    )
                )

        logger.info(
            f"파일 분석 완료: {file_path_obj.name}, "
            f"함수 {len(analysis.functions)}개, "
            f"클래스 {len(analysis.classes)}개, "
            f"호출 {len(edges)}개"
        )

        return AnalysisResponse(
            file_path=str(file_path_obj),
            nodes=nodes,
            edges=edges,
            raw_analysis=analysis,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"파일 분석 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"파일 분석 실패: {str(e)}")


@router.get("/health")
async def health_check() -> dict[str, str]:
    """헬스 체크"""
    return {"status": "ok", "service": "algorithm-visualization"}

