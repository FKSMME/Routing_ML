"""
Python 코드 AST 분석 모듈

Python 파일을 분석하여 함수, 클래스, 호출 관계를 추출합니다.
알고리즘 시각화 워크스페이스를 위한 노드/엣지 데이터를 생성합니다.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

from pydantic import BaseModel


class FunctionInfo(BaseModel):
    """함수 정보"""

    name: str
    line_start: int
    line_end: int
    parameters: list[str]
    return_annotation: str | None
    docstring: str | None
    decorators: list[str]
    is_async: bool


class ClassInfo(BaseModel):
    """클래스 정보"""

    name: str
    line_start: int
    line_end: int
    bases: list[str]
    methods: list[str]
    docstring: str | None
    decorators: list[str]


class CallInfo(BaseModel):
    """함수 호출 정보"""

    caller: str  # 호출하는 함수/클래스 이름
    callee: str  # 호출되는 함수 이름
    line: int


class FileAnalysis(BaseModel):
    """파일 분석 결과"""

    file_path: str
    functions: list[FunctionInfo]
    classes: list[ClassInfo]
    calls: list[CallInfo]
    imports: list[str]
    errors: list[str]


class ASTAnalyzer(ast.NodeVisitor):
    """AST 방문자 클래스"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.functions: list[FunctionInfo] = []
        self.classes: list[ClassInfo] = []
        self.calls: list[CallInfo] = []
        self.imports: list[str] = []
        self.errors: list[str] = []
        self.current_scope: str | None = None

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        """함수 정의 방문"""
        try:
            # 파라미터 추출
            params = []
            for arg in node.args.args:
                param_str = arg.arg
                if arg.annotation:
                    param_str += f": {ast.unparse(arg.annotation)}"
                params.append(param_str)

            # 반환 타입 추출
            return_annotation = None
            if node.returns:
                return_annotation = ast.unparse(node.returns)

            # Docstring 추출
            docstring = ast.get_docstring(node)

            # 데코레이터 추출
            decorators = [ast.unparse(dec) for dec in node.decorator_list]

            func_info = FunctionInfo(
                name=node.name,
                line_start=node.lineno,
                line_end=node.end_lineno or node.lineno,
                parameters=params,
                return_annotation=return_annotation,
                docstring=docstring,
                decorators=decorators,
                is_async=isinstance(node, ast.AsyncFunctionDef),
            )
            self.functions.append(func_info)

            # 함수 내부 호출 분석을 위해 스코프 설정
            previous_scope = self.current_scope
            self.current_scope = node.name
            self.generic_visit(node)
            self.current_scope = previous_scope
        except Exception as e:
            self.errors.append(f"함수 {node.name} 분석 오류: {str(e)}")

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        """비동기 함수 정의 방문"""
        self.visit_FunctionDef(node)  # type: ignore

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        """클래스 정의 방문"""
        try:
            # 베이스 클래스 추출
            bases = [ast.unparse(base) for base in node.bases]

            # 메서드 이름 추출
            methods = []
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    methods.append(item.name)

            # Docstring 추출
            docstring = ast.get_docstring(node)

            # 데코레이터 추출
            decorators = [ast.unparse(dec) for dec in node.decorator_list]

            class_info = ClassInfo(
                name=node.name,
                line_start=node.lineno,
                line_end=node.end_lineno or node.lineno,
                bases=bases,
                methods=methods,
                docstring=docstring,
                decorators=decorators,
            )
            self.classes.append(class_info)

            # 🔥 클래스 내부 메소드를 개별 함수 노드로 추가
            previous_scope = self.current_scope
            self.current_scope = f"{node.name}"

            # 클래스 메소드를 순회하며 함수 노드로 추가
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    self.visit_FunctionDef(item)
                elif isinstance(item, ast.AsyncFunctionDef):
                    self.visit_AsyncFunctionDef(item)

            self.current_scope = previous_scope
        except Exception as e:
            self.errors.append(f"클래스 {node.name} 분석 오류: {str(e)}")

    def visit_Call(self, node: ast.Call) -> None:
        """함수 호출 방문"""
        try:
            callee = None
            if isinstance(node.func, ast.Name):
                callee = node.func.id
            elif isinstance(node.func, ast.Attribute):
                callee = node.func.attr

            if callee and self.current_scope:
                call_info = CallInfo(
                    caller=self.current_scope,
                    callee=callee,
                    line=node.lineno,
                )
                self.calls.append(call_info)
        except Exception as e:
            self.errors.append(f"호출 분석 오류 (line {node.lineno}): {str(e)}")

        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        """import 문 방문"""
        for alias in node.names:
            self.imports.append(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """from ... import 문 방문"""
        if node.module:
            for alias in node.names:
                import_str = f"{node.module}.{alias.name}"
                self.imports.append(import_str)
        self.generic_visit(node)


def analyze_python_file(file_path: str) -> FileAnalysis:
    """
    Python 파일을 분석하여 함수, 클래스, 호출 관계를 추출합니다.

    Args:
        file_path: 분석할 Python 파일 경로

    Returns:
        FileAnalysis: 분석 결과
    """
    path = Path(file_path)

    if not path.exists():
        return FileAnalysis(
            file_path=file_path,
            functions=[],
            classes=[],
            calls=[],
            imports=[],
            errors=[f"파일을 찾을 수 없습니다: {file_path}"],
        )

    if not path.is_file():
        return FileAnalysis(
            file_path=file_path,
            functions=[],
            classes=[],
            calls=[],
            imports=[],
            errors=[f"파일이 아닙니다: {file_path}"],
        )

    try:
        with open(path, "r", encoding="utf-8") as f:
            source_code = f.read()

        tree = ast.parse(source_code, filename=str(path))
        analyzer = ASTAnalyzer(file_path)
        analyzer.visit(tree)

        return FileAnalysis(
            file_path=file_path,
            functions=analyzer.functions,
            classes=analyzer.classes,
            calls=analyzer.calls,
            imports=analyzer.imports,
            errors=analyzer.errors,
        )
    except SyntaxError as e:
        return FileAnalysis(
            file_path=file_path,
            functions=[],
            classes=[],
            calls=[],
            imports=[],
            errors=[f"구문 오류: {str(e)}"],
        )
    except Exception as e:
        return FileAnalysis(
            file_path=file_path,
            functions=[],
            classes=[],
            calls=[],
            imports=[],
            errors=[f"분석 오류: {str(e)}"],
        )


def list_python_files(directory: str, include_patterns: list[str] | None = None) -> list[dict[str, Any]]:
    """
    디렉토리에서 Python 파일 목록을 반환합니다.

    Args:
        directory: 검색할 디렉토리 경로
        include_patterns: 포함할 파일 패턴 (예: ["trainer*", "predictor*"])

    Returns:
        파일 정보 리스트
    """
    dir_path = Path(directory)

    if not dir_path.exists() or not dir_path.is_dir():
        return []

    files = []

    for py_file in dir_path.rglob("*.py"):
        # __pycache__, venv 등 제외
        if any(part.startswith("__") or part.startswith(".") or part == "venv" for part in py_file.parts):
            continue

        # 패턴 필터링
        if include_patterns:
            if not any(py_file.match(pattern) for pattern in include_patterns):
                continue

        try:
            stat = py_file.stat()
            relative_path = str(py_file.relative_to(dir_path))

            # 간단한 분석 (함수/클래스 개수만)
            with open(py_file, "r", encoding="utf-8") as f:
                source = f.read()
                tree = ast.parse(source)

            func_count = sum(1 for node in ast.walk(tree) if isinstance(node, ast.FunctionDef))
            class_count = sum(1 for node in ast.walk(tree) if isinstance(node, ast.ClassDef))

            files.append(
                {
                    "id": str(py_file),
                    "name": py_file.name,
                    "path": relative_path,
                    "full_path": str(py_file),
                    "size": stat.st_size,
                    "functions": func_count,
                    "classes": class_count,
                    "modified": stat.st_mtime,
                }
            )
        except Exception:
            # 분석 실패한 파일은 스킵
            continue

    return sorted(files, key=lambda x: x["name"])
