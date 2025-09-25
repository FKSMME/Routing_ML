"""기본 smoke 테스트: pytest 수집 시 최소 1건 이상의 테스트가 실행되도록 보장."""

import ast
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MAIN_PATH = PROJECT_ROOT / "main.py"


def test_main_module_has_entrypoint() -> None:
    """main.py 안에 main 함수 정의가 존재하는지 AST 수준에서 검사한다."""
    source = MAIN_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source)
    has_main = any(isinstance(node, ast.FunctionDef) and node.name == "main" for node in tree.body)
    assert has_main, "main.py에 main 함수가 필요합니다."
