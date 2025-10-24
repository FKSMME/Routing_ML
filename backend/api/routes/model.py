"""FastAPI routes for model management and selection."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.api.security import get_current_user
from backend.api.config import Settings, get_settings
from backend.maintenance.model_registry import (
    ModelVersion,
    get_active_version,
    list_versions,
)
from backend.models.user import User

router = APIRouter(prefix="/models", tags=["models"])


class ModelVersionResponse(BaseModel):
    """Response schema for model version information."""

    version_name: str = Field(..., description="Model version identifier")
    artifact_dir: str = Field(..., description="Directory containing model artifacts")
    manifest_path: str = Field(..., description="Path to model manifest file")
    status: str = Field(..., description="Model lifecycle status (pending/active/retired)")
    active_flag: bool = Field(..., description="Whether this is the currently active model")
    requested_by: Optional[str] = Field(None, description="User who requested this model version")
    created_at: str = Field(..., description="ISO timestamp of model creation")
    trained_at: Optional[str] = Field(None, description="ISO timestamp of training completion")
    activated_at: Optional[str] = Field(None, description="ISO timestamp of activation")
    updated_at: Optional[str] = Field(None, description="ISO timestamp of last update")

    class Config:
        from_attributes = True


class ModelListResponse(BaseModel):
    """Response schema for list of model versions."""

    models: List[ModelVersionResponse] = Field(default_factory=list, description="Available model versions")
    active_model: Optional[ModelVersionResponse] = Field(None, description="Currently active model version")
    total: int = Field(..., ge=0, description="Total number of models")


@router.get("", response_model=ModelListResponse)
def list_model_versions(
    limit: Optional[int] = None,
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
):
    """
    List all available model versions.

    Returns model versions ordered by creation date (newest first).
    Includes the currently active model if one exists.
    """
    try:
        # Get model versions from registry
        versions = list_versions(db_url=settings.rsl_database_url, limit=limit)

        # Get active model
        active_version = get_active_version(db_url=settings.rsl_database_url)

        # Convert to response models
        model_responses = [ModelVersionResponse(**v.to_dict()) for v in versions]
        active_response = ModelVersionResponse(**active_version.to_dict()) if active_version else None

        return ModelListResponse(
            models=model_responses,
            active_model=active_response,
            total=len(model_responses),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve model versions: {str(e)}",
        )


@router.get("/active", response_model=Optional[ModelVersionResponse])
def get_active_model(
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
):
    """
    Get the currently active model version.

    Returns None if no model is currently active.
    """
    try:
        active_version = get_active_version(db_url=settings.rsl_database_url)
        if not active_version:
            return None
        return ModelVersionResponse(**active_version.to_dict())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve active model: {str(e)}",
        )


