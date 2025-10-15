"""Blueprint & Algorithm Visualization API.

Real-time code structure visualization and blueprint editing with code generation.
"""
from __future__ import annotations

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()

import ast
import importlib.util
import inspect
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from backend.api.schemas import AuthenticatedUser
from backend.api.security import require_auth
from common.logger import get_logger

router = APIRouter(prefix="/api/blueprint", tags=["blueprint"])
logger = get_logger("api.blueprint")

# Simple cache to avoid re-analyzing files
_analysis_cache: Dict[str, tuple[datetime, Dict[str, Any]]] = {}
CACHE_TTL = timedelta(minutes=5)


class FunctionNode(BaseModel):
    """Function node representation"""
    id: str
    name: str
    module: str
    file_path: str
    line_number: int
    doc: Optional[str] = None
    args: List[str] = []
    returns: Optional[str] = None


class CallEdge(BaseModel):
    """Function call edge"""
    source: str
    target: str
    call_type: str  # direct, async, conditional


class CodeStructure(BaseModel):
    """Code structure graph"""
    nodes: List[FunctionNode]
    edges: List[CallEdge]
    entry_points: List[str]


class BlueprintNode(BaseModel):
    """Blueprint editor node"""
    id: str
    type: str
    label: str
    data: Dict[str, Any]
    position: Dict[str, float]


class BlueprintEdge(BaseModel):
    """Blueprint editor edge"""
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None


class Blueprint(BaseModel):
    """Complete blueprint"""
    nodes: List[BlueprintNode]
    edges: List[BlueprintEdge]
    metadata: Dict[str, Any] = {}


def extract_function_calls(func_ast: ast.FunctionDef) -> List[str]:
    """Extract all function calls from AST"""
    calls = []

    for node in ast.walk(func_ast):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                calls.append(node.func.id)
            elif isinstance(node.func, ast.Attribute):
                calls.append(node.func.attr)

    return calls


def analyze_python_file(file_path: Path, max_functions: int = 50) -> Dict[str, Any]:
    """Analyze Python file structure using AST

    Args:
        file_path: Path to Python file
        max_functions: Maximum number of functions to analyze (default 50)
    """
    # Check cache first
    cache_key = str(file_path)
    if cache_key in _analysis_cache:
        cached_time, cached_result = _analysis_cache[cache_key]
        if datetime.now() - cached_time < CACHE_TTL:
            logger.debug(f"Using cached analysis for {file_path}")
            return cached_result

    try:
        logger.info(f"Analyzing {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()

        tree = ast.parse(source, filename=str(file_path))

        functions = []
        calls = []
        func_count = 0

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Limit number of functions to analyze
                if func_count >= max_functions:
                    logger.warning(f"Reached max_functions limit ({max_functions}) for {file_path}")
                    break

                func_count += 1

                # Extract function info (skip private/internal functions for now)
                if node.name.startswith('__') and node.name != '__init__':
                    continue

                func_info = {
                    'name': node.name,
                    'line': node.lineno,
                    'args': [arg.arg for arg in node.args.args][:5],  # Limit args display
                    'doc': (ast.get_docstring(node) or '')[:200],  # Limit docstring length
                    'calls': extract_function_calls(node)[:10]  # Limit calls
                }

                # Extract return type if annotated
                if node.returns:
                    if isinstance(node.returns, ast.Name):
                        func_info['returns'] = node.returns.id
                    elif isinstance(node.returns, ast.Constant):
                        func_info['returns'] = str(node.returns.value)

                functions.append(func_info)

                # Add function calls as edges (limited)
                for call in func_info['calls'][:5]:  # Only first 5 calls
                    calls.append({
                        'source': node.name,
                        'target': call,
                        'type': 'direct'
                    })

        result = {
            'file': str(file_path),
            'functions': functions,
            'calls': calls,
            'truncated': func_count >= max_functions
        }

        # Cache the result
        _analysis_cache[cache_key] = (datetime.now(), result)
        logger.info(f"Analyzed {len(functions)} functions from {file_path}")

        return result

    except Exception as e:
        logger.error(f"Failed to analyze {file_path}: {e}")
        return {
            'file': str(file_path),
            'functions': [],
            'calls': [],
            'error': str(e)
        }


@router.get("/structure")
async def get_code_structure(
    module: str = "all",
    current_user: AuthenticatedUser = Depends(require_auth),
) -> CodeStructure:
    """
    Extract code structure from Python files

    Args:
        module: "all", "training", "prediction", or "database"
    """
    logger.info(f"Code structure request: module={module}, user={current_user.username}")

    # Define file paths to analyze
    base_path = Path(__file__).parents[2]  # backend/

    files_to_analyze = []

    if module in ["all", "training"]:
        files_to_analyze.append(base_path / "trainer_ml.py")

    if module in ["all", "prediction"]:
        files_to_analyze.append(base_path / "predictor_ml.py")

    if module in ["all", "database"]:
        files_to_analyze.append(base_path / "database.py")

    # Analyze all files
    all_nodes = []
    all_edges = []
    entry_points = []

    for file_path in files_to_analyze:
        if not file_path.exists():
            continue

        analysis = analyze_python_file(file_path)
        module_name = file_path.stem

        # Create nodes
        for func in analysis['functions']:
            node_id = f"{module_name}.{func['name']}"

            node = FunctionNode(
                id=node_id,
                name=func['name'],
                module=module_name,
                file_path=str(file_path),
                line_number=func['line'],
                doc=func.get('doc'),
                args=func['args'],
                returns=func.get('returns')
            )

            all_nodes.append(node)

            # Mark entry points (public functions)
            if not func['name'].startswith('_'):
                entry_points.append(node_id)

        # Create edges
        for call in analysis['calls']:
            source_id = f"{module_name}.{call['source']}"
            target_id = f"{module_name}.{call['target']}"

            edge = CallEdge(
                source=source_id,
                target=target_id,
                call_type=call['type']
            )

            all_edges.append(edge)

    return CodeStructure(
        nodes=all_nodes,
        edges=all_edges,
        entry_points=entry_points
    )


@router.post("/generate-code")
async def generate_code_from_blueprint(
    blueprint: Blueprint,
    target_module: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Dict[str, Any]:
    """
    Generate Python code from blueprint

    Args:
        blueprint: Node/edge diagram
        target_module: Module to generate code for
    """
    logger.info(f"Code generation request: module={target_module}, user={current_user.username}")

    try:
        # Generate Python code from blueprint
        generated_code = []
        generated_code.append("# Auto-generated from blueprint")
        generated_code.append("# DO NOT EDIT MANUALLY\n")

        # Sort nodes by dependencies
        node_order = topological_sort(blueprint.nodes, blueprint.edges)

        for node_id in node_order:
            node = next((n for n in blueprint.nodes if n.id == node_id), None)
            if not node:
                continue

            # Generate function based on node type
            if node.type == "function":
                func_code = generate_function(node, blueprint.edges)
                generated_code.append(func_code)
            elif node.type == "class":
                class_code = generate_class(node, blueprint.edges)
                generated_code.append(class_code)

        code_str = "\n\n".join(generated_code)

        return {
            "code": code_str,
            "file_path": f"backend/{target_module}_generated.py",
            "nodes_count": len(blueprint.nodes),
            "edges_count": len(blueprint.edges)
        }

    except Exception as e:
        logger.error(f"Code generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")


def topological_sort(nodes: List[BlueprintNode], edges: List[BlueprintEdge]) -> List[str]:
    """Topological sort of nodes based on edges"""
    # Build adjacency list
    graph = {node.id: [] for node in nodes}
    in_degree = {node.id: 0 for node in nodes}

    for edge in edges:
        if edge.source in graph:
            graph[edge.source].append(edge.target)
            if edge.target in in_degree:
                in_degree[edge.target] += 1

    # Kahn's algorithm
    queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
    result = []

    while queue:
        node_id = queue.pop(0)
        result.append(node_id)

        for neighbor in graph.get(node_id, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return result


def generate_function(node: BlueprintNode, edges: List[BlueprintEdge]) -> str:
    """Generate function code from node"""
    func_name = node.data.get('name', 'unnamed_function')
    args = node.data.get('args', [])
    doc = node.data.get('doc', '')

    # Find function calls from edges
    calls = [e.target for e in edges if e.source == node.id]

    code_lines = []
    code_lines.append(f"def {func_name}({', '.join(args)}):")

    if doc:
        code_lines.append(f'    """{doc}"""')

    # Generate function body
    if calls:
        for call in calls:
            call_name = call.split('.')[-1]
            code_lines.append(f"    result = {call_name}()")
    else:
        code_lines.append("    pass")

    code_lines.append("    return result")

    return "\n".join(code_lines)


def generate_class(node: BlueprintNode, edges: List[BlueprintEdge]) -> str:
    """Generate class code from node"""
    class_name = node.data.get('name', 'UnnamedClass')
    doc = node.data.get('doc', '')

    code_lines = []
    code_lines.append(f"class {class_name}:")

    if doc:
        code_lines.append(f'    """{doc}"""')

    code_lines.append("    pass")

    return "\n".join(code_lines)


@router.websocket("/realtime")
async def realtime_execution_tracking(websocket: WebSocket):
    """
    WebSocket for real-time execution tracking with JWT authentication

    Sends execution events as functions are called during runtime

    Authentication: Send JWT token as first message {"token": "your_jwt_token"}
    """
    await websocket.accept()
    logger.info("WebSocket connection established, awaiting authentication")

    # Authenticate user with JWT token
    try:
        # Wait for authentication message
        auth_message = await websocket.receive_json()
        token = auth_message.get("token")

        if not token:
            await websocket.send_json({
                "type": "error",
                "message": "Authentication required: send {\"token\": \"your_jwt_token\"}"
            })
            await websocket.close(code=1008)  # Policy violation
            return

        # Verify JWT token
        from backend.api.session_manager import get_jwt_manager
        jwt_manager = get_jwt_manager()

        try:
            payload = jwt_manager.decode_token(token)
            username = payload.get("sub")

            if not username:
                raise ValueError("Invalid token payload")

            logger.info(f"WebSocket authenticated for user: {username}")

            await websocket.send_json({
                "type": "authenticated",
                "username": username
            })

        except Exception as e:
            logger.warning(f"WebSocket authentication failed: {e}")
            await websocket.send_json({
                "type": "error",
                "message": "Authentication failed: invalid or expired token"
            })
            await websocket.close(code=1008)  # Policy violation
            return

    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        await websocket.close(code=1011)  # Internal error
        return

    # Main WebSocket loop (authenticated)
    try:
        while True:
            # In a real implementation, this would hook into Python's trace system
            # For now, we'll send mock events
            message = await websocket.receive_text()

            if message == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now().isoformat(),
                    "user": username
                })
            elif message == "start_tracking":
                await websocket.send_json({
                    "type": "tracking_started",
                    "modules": ["trainer_ml", "predictor_ml", "database"],
                    "user": username
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user: {username}")


__all__ = ["router"]
