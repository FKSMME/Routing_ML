"""Custom process nodes management API routes."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from backend.api.security import require_auth
from backend.api.schemas import AuthenticatedUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/custom-nodes", tags=["custom-nodes"])

# Data storage path
DATA_DIR = Path("data/custom_nodes")
DATA_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────

class CustomNodeCreate(BaseModel):
    """Request model for creating a custom node."""
    process_code: str = Field(..., min_length=1, max_length=50, description="Process code (e.g., WELD, PAINT)")
    process_name: str = Field(..., min_length=1, max_length=100, description="Process name in Korean or English")
    estimated_time: float | None = Field(None, ge=0, description="Estimated time in minutes")
    color: str | None = Field(None, max_length=20, description="UI color code (e.g., #FF5733, orange)")


class CustomNodeUpdate(BaseModel):
    """Request model for updating a custom node."""
    process_code: str | None = Field(None, min_length=1, max_length=50)
    process_name: str | None = Field(None, min_length=1, max_length=100)
    estimated_time: float | None = Field(None, ge=0)
    color: str | None = Field(None, max_length=20)


class CustomNodeResponse(BaseModel):
    """Response model for a custom node."""
    id: str
    user_id: str
    process_code: str
    process_name: str
    estimated_time: float | None
    color: str | None
    created_at: str
    updated_at: str


# ─────────────────────────────────────────────────
# Data Access Functions
# ─────────────────────────────────────────────────

def _get_user_file_path(user_id: str) -> Path:
    """Get the JSON file path for a user's custom nodes."""
    return DATA_DIR / f"{user_id}.json"


def _load_user_nodes(user_id: str) -> List[dict]:
    """Load all custom nodes for a user."""
    file_path = _get_user_file_path(user_id)
    if not file_path.exists():
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as exc:
        logger.error(f"Failed to load custom nodes for user {user_id}: {exc}")
        return []


def _save_user_nodes(user_id: str, nodes: List[dict]) -> None:
    """Save all custom nodes for a user."""
    file_path = _get_user_file_path(user_id)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(nodes, f, ensure_ascii=False, indent=2)
    except IOError as exc:
        logger.error(f"Failed to save custom nodes for user {user_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save custom nodes",
        ) from exc


# ─────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────

@router.get("", response_model=List[CustomNodeResponse])
async def list_custom_nodes(
    current_user: AuthenticatedUser = Depends(require_auth),
) -> List[CustomNodeResponse]:
    """Get all custom nodes for the current user."""
    nodes = _load_user_nodes(current_user.user_id)
    logger.info(f"User {current_user.username} loaded {len(nodes)} custom nodes")
    return [CustomNodeResponse(**node) for node in nodes]


@router.post("", response_model=CustomNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_node(
    node_data: CustomNodeCreate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> CustomNodeResponse:
    """Create a new custom node."""
    nodes = _load_user_nodes(current_user.user_id)

    # Check for duplicate process_code
    if any(n["process_code"] == node_data.process_code for n in nodes):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Process code '{node_data.process_code}' already exists",
        )

    # Create new node
    now = datetime.now(UTC).isoformat()
    new_node = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "process_code": node_data.process_code,
        "process_name": node_data.process_name,
        "estimated_time": node_data.estimated_time,
        "color": node_data.color,
        "created_at": now,
        "updated_at": now,
    }

    nodes.append(new_node)
    _save_user_nodes(current_user.user_id, nodes)

    logger.info(f"User {current_user.username} created custom node: {node_data.process_code}")
    return CustomNodeResponse(**new_node)


@router.put("/{node_id}", response_model=CustomNodeResponse)
async def update_custom_node(
    node_id: str,
    node_data: CustomNodeUpdate,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> CustomNodeResponse:
    """Update an existing custom node."""
    nodes = _load_user_nodes(current_user.user_id)

    # Find node
    node_index = next((i for i, n in enumerate(nodes) if n["id"] == node_id), None)
    if node_index is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found",
        )

    node = nodes[node_index]

    # Check for duplicate process_code if changing
    if node_data.process_code and node_data.process_code != node["process_code"]:
        if any(n["process_code"] == node_data.process_code for n in nodes):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Process code '{node_data.process_code}' already exists",
            )

    # Update fields
    if node_data.process_code is not None:
        node["process_code"] = node_data.process_code
    if node_data.process_name is not None:
        node["process_name"] = node_data.process_name
    if node_data.estimated_time is not None:
        node["estimated_time"] = node_data.estimated_time
    if node_data.color is not None:
        node["color"] = node_data.color

    node["updated_at"] = datetime.now(UTC).isoformat()
    nodes[node_index] = node

    _save_user_nodes(current_user.user_id, nodes)

    logger.info(f"User {current_user.username} updated custom node: {node_id}")
    return CustomNodeResponse(**node)


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_node(
    node_id: str,
    current_user: AuthenticatedUser = Depends(require_auth),
) -> Response:
    """Delete a custom node."""
    nodes = _load_user_nodes(current_user.user_id)

    # Find and remove node
    original_count = len(nodes)
    nodes = [n for n in nodes if n["id"] != node_id]

    if len(nodes) == original_count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node {node_id} not found",
        )

    _save_user_nodes(current_user.user_id, nodes)

    logger.info(f"User {current_user.username} deleted custom node: {node_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
